import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserId } from '@/lib/auth';
import { transactionSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { isCreditCardExpired } from '@/lib/utils';
import { getUserPlan } from '@/services/stripe/subscription';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { projectionCache } from '@/services/projections/cache';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const categoryId = searchParams.get('category_id');
    const search = searchParams.get('search');
    const type = searchParams.get('type'); // 'income' or 'expense'
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const isInstallment = searchParams.get('is_installment'); // 'true' or 'false'
    const assignedTo = searchParams.get('assigned_to');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sort_by') || 'posted_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    const { supabase } = createClientFromRequest(request);
    let query = supabase
      .from('transactions')
      .select('*, accounts(*), categories(*)', { count: 'exact' })
      .eq('user_id', ownerId)
      .range(offset, offset + limit - 1);

    // Apply sorting
    const ascending = sortOrder === 'asc';
    if (sortBy === 'amount') {
      query = query.order('amount', { ascending });
    } else {
      // Default to posted_at
      query = query.order('posted_at', { ascending });
    }

    if (accountId) {
      query = query.eq('account_id', accountId);
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    if (search) {
      query = query.ilike('description', `%${search}%`);
    }
    if (type) {
      if (type === 'income') {
        query = query.gt('amount', 0);
      } else if (type === 'expense') {
        query = query.lt('amount', 0);
      }
    }
    if (fromDate) {
      // Ensure we're comparing dates correctly (start of day)
      query = query.gte('posted_at', fromDate);
    }
    if (toDate) {
      // Ensure we're comparing dates correctly (end of day)
      query = query.lte('posted_at', toDate);
    }
    if (isInstallment !== null) {
      if (isInstallment === 'true') {
        // Filter for transactions that are part of an installment
        // They have installment_parent_id (are a child installment) OR have installment_total > 1 (are a parent with multiple installments)
        query = query.or('installment_parent_id.not.is.null,installment_total.gt.1');
      } else {
        // Filter for transactions that are NOT part of an installment
        // No parent AND (no installment_total OR installment_total is null or 1)
        query = query.is('installment_parent_id', null).or('installment_total.is.null,installment_total.eq.1');
      }
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Fetch assigned_to profiles separately using admin client (bypasses RLS)
    // This is needed because RLS on profiles only allows viewing own profile
    const assignedToIds = [...new Set((data || [])
      .map((tx: any) => tx.assigned_to)
      .filter((id: string | null) => id !== null))] as string[];

    let profilesMap: Record<string, any> = {};
    if (assignedToIds.length > 0) {
      const admin = createAdminClient();
      const { data: profiles, error: profilesError } = await admin
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', assignedToIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      } else if (profiles) {
        profilesMap = profiles.reduce((acc: Record<string, any>, profile: any) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }
    }

    // Convert amount (NUMERIC) to amount_cents (BIGINT) for API response
    // and merge assigned_to_profile data
    const transformedData = (data || []).map((tx: any) => {
      // Use the profile from the map if available, otherwise try the joined data
      const assignedProfile = tx.assigned_to 
        ? (profilesMap[tx.assigned_to] || tx.assigned_to_profile || null)
        : null;

      return {
        ...tx,
        amount_cents: Math.round((tx.amount || 0) * 100),
        assigned_to_profile: assignedProfile,
      };
    });

    return NextResponse.json({
      data: transformedData,
      count: count || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('Transactions GET error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { supabase } = createClientFromRequest(request);

    const body = await request.json();
    const validated = transactionSchema.parse(body);

    // Determine amount sign based on type if provided
    let amount = validated.amount_cents / 100;
    if (validated.type === 'expense' && amount > 0) {
      amount = -amount;
    } else if (validated.type === 'income' && amount < 0) {
      amount = Math.abs(amount);
    }

    // Check if account is a credit card
    const { data: account } = await supabase
      .from('accounts')
      .select('id, type, closing_day, due_day, expiration_date')
      .eq('id', validated.account_id)
      .single();

    if (!account) {
      return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });
    }

    // Check if credit card is expired
    if (account.type === 'credit_card' && isCreditCardExpired(account.expiration_date)) {
      return NextResponse.json(
        { error: 'Este cartão de crédito expirou e não pode ser mais utilizado' },
        { status: 400 }
      );
    }

    const isCreditCard = account?.type === 'credit_card';
    const isCreditCardPurchase = isCreditCard && (validated.type === 'expense' || validated.type === 'income');
    const shouldCountAsTransaction = !isCreditCardPurchase;

    // Check plan limits for Free users (only for real transactions)
    if (shouldCountAsTransaction) {
      const userPlan = await getUserPlan(ownerId);
      if (userPlan.plan === 'free') {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const { count } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', ownerId)
          .gte('created_at', firstDayOfMonth)
          .lte('created_at', lastDayOfMonth);

        if (count && count >= 100) {
          return NextResponse.json(
            { error: 'Limite de 100 transações mensais atingido no plano Free. Faça upgrade para o plano Pro ou Premium para transações ilimitadas.' },
            { status: 403 }
          );
        }
      }
    }
    let creditCardBillId: string | null = null;

    // Check if transaction is using a credit card category (payment of bill)
    // If category_id matches a credit card's category_id, this is a bill payment
    // This should happen AFTER the transaction is created, so we'll handle it later

    // Handle credit card transactions (expenses on credit card)
    if (isCreditCard && account.closing_day) {
      // Get or create the appropriate bill for this transaction
      const transactionDate = new Date(validated.posted_at);
      const closingDay = account.closing_day;
      const dueDay = account.due_day || closingDay + 10;

      // Determine which month's bill this transaction belongs to
      const day = transactionDate.getDate();
      let referenceMonth: Date;

      if (day > closingDay) {
        // Transaction after closing goes to next month's bill
        referenceMonth = new Date(transactionDate.getFullYear(), transactionDate.getMonth() + 1, 1);
      } else {
        referenceMonth = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), 1);
      }

      const referenceMonthStr = referenceMonth.toISOString().split('T')[0];

      // Check if bill exists
      const { data: existingBill } = await supabase
        .from('credit_card_bills')
        .select('id')
        .eq('account_id', validated.account_id)
        .eq('reference_month', referenceMonthStr)
        .single();

      if (existingBill) {
        creditCardBillId = existingBill.id;
      } else {
        // Create the bill
        // Calculate closing date (ensure it's valid for the month)
        const closingDate = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), closingDay);
        if (closingDate.getDate() !== closingDay) {
          closingDate.setDate(0); // Last day of previous month
        }

        // Calculate due date (ensure it's valid for the month)
        const dueDateObj = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), dueDay);
        if (dueDateObj.getDate() !== dueDay) {
          dueDateObj.setDate(0); // Last day of previous month
        }

        const { data: newBill } = await supabase
          .from('credit_card_bills')
          .insert({
            user_id: ownerId,
            account_id: validated.account_id,
            reference_month: referenceMonthStr,
            closing_date: closingDate.toISOString().split('T')[0],
            due_date: dueDateObj.toISOString().split('T')[0],
            status: 'open',
          })
          .select('id')
          .single();

        creditCardBillId = newBill?.id || null;
      }
    }

    // Handle installments (for any account type and both income/expense)
    const installmentTotal = validated.installment_total || 1;
    const isInstallment = installmentTotal > 1;

    if (isInstallment && (validated.type === 'expense' || validated.type === 'income')) {
      const installmentAmount = Math.round(validated.amount_cents / installmentTotal);

      if (isCreditCardPurchase) {
        const billItems: any[] = [];
        let parentId: string | null = null;

        for (let i = 1; i <= installmentTotal; i++) {
          const installmentDate = new Date(validated.posted_at);
          installmentDate.setMonth(installmentDate.getMonth() + (i - 1));

          let installmentBillId: string | null = null;
          if (account?.closing_day) {
            const closingDay = account.closing_day;
            const dueDay = account.due_day || closingDay + 10;
            const day = installmentDate.getDate();

            let referenceMonth: Date;
            if (day > closingDay) {
              referenceMonth = new Date(installmentDate.getFullYear(), installmentDate.getMonth() + 1, 1);
            } else {
              referenceMonth = new Date(installmentDate.getFullYear(), installmentDate.getMonth(), 1);
            }

            const referenceMonthStr = referenceMonth.toISOString().split('T')[0];

            const { data: bill } = await supabase
              .from('credit_card_bills')
              .select('id')
              .eq('account_id', validated.account_id)
              .eq('reference_month', referenceMonthStr)
              .single();

            if (bill) {
              installmentBillId = bill.id;
            } else {
              const closingDate = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), closingDay);
              if (closingDate.getDate() !== closingDay) {
                closingDate.setDate(0);
              }

              const dueDateObj = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), dueDay);
              if (dueDateObj.getDate() !== dueDay) {
                dueDateObj.setDate(0);
              }

              const { data: newBill } = await supabase
                .from('credit_card_bills')
                .insert({
                  user_id: ownerId,
                  account_id: validated.account_id,
                  reference_month: referenceMonthStr,
                  closing_date: closingDate.toISOString().split('T')[0],
                  due_date: dueDateObj.toISOString().split('T')[0],
                  status: 'open',
                })
                .select('id')
                .single();

              installmentBillId = newBill?.id || null;
            }
          }

          if (!installmentBillId) {
            throw new Error('Fatura do cartão não encontrada para a parcela');
          }

          const installmentAmountCents = validated.type === 'income'
            ? -Math.abs(installmentAmount)
            : Math.abs(installmentAmount);

          const itemData: Record<string, unknown> = {
            user_id: ownerId,
            account_id: validated.account_id,
            bill_id: installmentBillId,
            category_id: validated.category_id || null,
            posted_at: installmentDate.toISOString().split('T')[0],
            description: `${validated.description} (${i}/${validated.installment_total})`,
            amount_cents: installmentAmountCents,
            currency: validated.currency,
            notes: validated.notes || null,
            source: validated.source || 'manual',
            provider_tx_id: validated.provider_tx_id || null,
            installment_number: i,
            installment_total: validated.installment_total,
            assigned_to: validated.assigned_to || null,
          };

          if (i === 1) {
            const { data: firstItem, error: firstError } = await supabase
              .from('credit_card_bill_items')
              .insert(itemData)
              .select('*')
              .single();

            if (firstError) throw firstError;
            parentId = firstItem.id;
            billItems.push(firstItem);
          } else {
            itemData.installment_parent_id = parentId;
            billItems.push(itemData);
          }
        }

        if (billItems.length > 1) {
          const remainingItems = billItems.slice(1);
          const { error: bulkError } = await supabase
            .from('credit_card_bill_items')
            .insert(remainingItems);

          if (bulkError) throw bulkError;
        }

        await updateCreditCardBillTotals(supabase, validated.account_id);
        projectionCache.invalidateUser(ownerId);

        return NextResponse.json({
          data: { ...billItems[0], is_bill_item: true },
          installments_created: validated.installment_total,
        }, { status: 201 });
      }

      const transactions: any[] = [];
      let parentId: string | null = null;

      for (let i = 1; i <= installmentTotal; i++) {
        const installmentDate = new Date(validated.posted_at);
        installmentDate.setMonth(installmentDate.getMonth() + (i - 1));

        const installmentAmountReais = validated.type === 'income'
          ? Math.abs(installmentAmount / 100)
          : -Math.abs(installmentAmount / 100);

        const txData: Record<string, unknown> = {
          account_id: validated.account_id,
          category_id: validated.category_id || null,
          posted_at: installmentDate.toISOString().split('T')[0],
          description: `${validated.description} (${i}/${validated.installment_total})`,
          amount: installmentAmountReais,
          currency: validated.currency,
          notes: validated.notes || null,
          user_id: ownerId,
          source: validated.source || 'manual',
          installment_number: i,
          installment_total: validated.installment_total,
          assigned_to: validated.assigned_to || null,
        };

        if (i === 1) {
          const { data: firstTx, error: firstError } = await supabase
            .from('transactions')
            .insert(txData)
            .select('*, accounts(*), categories(*)')
            .single();

          if (firstError) throw firstError;
          parentId = firstTx.id;
          transactions.push(firstTx);
        } else {
          txData.installment_parent_id = parentId;
          transactions.push(txData);
        }
      }

      if (transactions.length > 1) {
        const remainingTxs = transactions.slice(1);
        const { error: bulkError } = await supabase
          .from('transactions')
          .insert(remainingTxs);

        if (bulkError) throw bulkError;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 1; i <= installmentTotal; i++) {
        const installmentDate = new Date(validated.posted_at);
        installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
        installmentDate.setHours(0, 0, 0, 0);

        if (installmentDate > today && validated.category_id) {
          const year = installmentDate.getFullYear();
          const month = installmentDate.getMonth() + 1;
          const installmentAmountCents = validated.type === 'income'
            ? Math.abs(installmentAmount)
            : -Math.abs(installmentAmount);

          const { data: existingBudget } = await supabase
            .from('budgets')
            .select('id, amount_planned_cents')
            .eq('user_id', ownerId)
            .eq('category_id', validated.category_id)
            .eq('year', year)
            .eq('month', month)
            .single();

          if (existingBudget) {
            await supabase
              .from('budgets')
              .update({
                amount_planned_cents: (existingBudget.amount_planned_cents || 0) + installmentAmountCents,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingBudget.id);
          } else {
            await supabase
              .from('budgets')
              .insert({
                user_id: ownerId,
                category_id: validated.category_id,
                year,
                month,
                amount_planned_cents: installmentAmountCents,
                amount_actual: 0,
              });
          }
        }
      }

      const transformedTransactions = transactions.map((tx: any) => ({
        ...tx,
        amount_cents: Math.round((tx.amount || 0) * 100),
      }));

      projectionCache.invalidateUser(ownerId);

      return NextResponse.json({
        data: transformedTransactions[0],
        installments_created: validated.installment_total,
      }, { status: 201 });
    }

    if (isCreditCardPurchase) {
      if (!creditCardBillId) {
        return NextResponse.json({ error: 'Fatura do cartão não encontrada' }, { status: 400 });
      }

      const billItemAmountCents = validated.type === 'income'
        ? -Math.abs(validated.amount_cents)
        : Math.abs(validated.amount_cents);

      const { data: billItem, error: billItemError } = await supabase
        .from('credit_card_bill_items')
        .insert({
          user_id: ownerId,
          account_id: validated.account_id,
          bill_id: creditCardBillId,
          category_id: validated.category_id || null,
          posted_at: validated.posted_at,
          description: validated.description,
          amount_cents: billItemAmountCents,
          currency: validated.currency,
          notes: validated.notes || null,
          source: validated.source || 'manual',
          provider_tx_id: validated.provider_tx_id || null,
          assigned_to: validated.assigned_to || null,
        })
        .select('*')
        .single();

      if (billItemError) throw billItemError;

      await updateCreditCardBillTotals(supabase, validated.account_id);
      projectionCache.invalidateUser(ownerId);

      return NextResponse.json({ data: { ...billItem, is_bill_item: true } }, { status: 201 });
    }

    // Regular transaction (no installments)
    const insertData: any = {
      account_id: validated.account_id,
      category_id: validated.category_id || null,
      posted_at: validated.posted_at,
      description: validated.description,
      amount: amount, // Store as NUMERIC (reais) in database
      currency: validated.currency,
      notes: validated.notes || null,
      user_id: ownerId,
      source: validated.source || 'manual',
      provider_tx_id: validated.provider_tx_id || null,
      recurrence_rule: validated.recurrence_rule || null,
      include_in_plan: validated.include_in_plan ?? (!!validated.contribution_frequency || !!validated.recurrence_rule),
      installment_number: validated.installment_number || null,
      installment_total: validated.installment_total || null,
      assigned_to: validated.assigned_to || null,
    };

    // Only include credit_card_bill_id if it exists and is not null
    if (creditCardBillId) {
      insertData.credit_card_bill_id = creditCardBillId;
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert(insertData)
      .select(`
        *,
        accounts(id, name, type, institution, currency, current_balance, available_balance, credit_limit, color, icon),
        categories(id, name, type, icon, color)
      `)
      .single();

    if (error) throw error;

    // If this is a payment transaction (using credit card category), process it
    // Check if category_id matches a credit card's category_id (bill payment)
    // This is when the user pays the credit card bill - this SHOULD affect the account balance
    if (validated.category_id && !isCreditCard) {
      const { data: creditCard } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', ownerId)
        .eq('type', 'credit_card')
        .eq('category_id', validated.category_id)
        .single();

      if (creditCard) {
        // This is a payment of a credit card bill
        // This payment transaction will affect the account balance normally
        await processCreditCardBillPayment(
          supabase,
          ownerId,
          validated.category_id,
          Math.abs(validated.amount_cents),
          validated.posted_at
        );
      }
    }

    // Process investments, goals, and debts based on category
    await processInvestmentGoalDebtTransactions(supabase, ownerId, validated.category_id, data.id, validated.amount_cents, validated.posted_at);

    // Create budget for future transactions
    const transactionDate = new Date(validated.posted_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    transactionDate.setHours(0, 0, 0, 0);

    if (transactionDate > today && validated.category_id) {
      const year = transactionDate.getFullYear();
      const month = transactionDate.getMonth() + 1;
      const transactionAmountCents = validated.type === 'income'
        ? Math.abs(validated.amount_cents)
        : -Math.abs(validated.amount_cents);

      // Check if budget exists
      const { data: existingBudget } = await supabase
        .from('budgets')
        .select('id, amount_planned_cents')
        .eq('user_id', ownerId)
        .eq('category_id', validated.category_id)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (existingBudget) {
        // Update existing budget
        await supabase
          .from('budgets')
          .update({
            amount_planned_cents: (existingBudget.amount_planned_cents || 0) + transactionAmountCents,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingBudget.id);
      } else {
        // Create new budget
        await supabase
          .from('budgets')
          .insert({
            user_id: ownerId,
            category_id: validated.category_id,
            year,
            month,
            amount_planned_cents: transactionAmountCents,
            amount_actual: 0,
          });
      }
    }

    // Convert amount (NUMERIC) to amount_cents (BIGINT) for API response
    const transformedData = {
      ...data,
      amount_cents: Math.round((data.amount || 0) * 100),
    };

    projectionCache.invalidateUser(ownerId);

    return NextResponse.json({ data: transformedData }, { status: 201 });
  } catch (error) {
    console.error('Transactions POST error:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error },
        { status: 400 }
      );
    }
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

// Helper function to update credit card bill totals
async function updateCreditCardBillTotals(supabase: any, accountId: string) {
  // Get all open/closed bills for this card
  const { data: bills } = await supabase
    .from('credit_card_bills')
    .select('id')
    .eq('account_id', accountId)
    .in('status', ['open', 'closed']);

  if (!bills) return;

  for (const bill of bills) {
    // Sum bill items for this bill
    const { data: billItems } = await supabase
      .from('credit_card_bill_items')
      .select('amount_cents')
      .eq('bill_id', bill.id);

    const total = (billItems || [])
      .reduce((sum: number, item: { amount_cents: number }) => sum + (item.amount_cents || 0), 0);
    const totalForBill = Math.max(total, 0);

    // Update bill total
    await supabase
      .from('credit_card_bills')
      .update({
        total_cents: totalForBill,
        minimum_payment_cents: totalForBill > 0 ? Math.max(Math.round(totalForBill * 0.15), 5000) : 0,
      })
      .eq('id', bill.id);
  }

  // Update card available limit
  const { data: card } = await supabase
    .from('accounts')
    .select('credit_limit')
    .eq('id', accountId)
    .single();

  if (card) {
    const { data: openBills } = await supabase
      .from('credit_card_bills')
      .select('total_cents, paid_cents')
      .eq('account_id', accountId)
      .neq('status', 'paid');

    const totalUsed = (openBills || [])
      .reduce((sum: number, b: { total_cents: number; paid_cents: number }) =>
        sum + (b.total_cents - b.paid_cents), 0);

    // Convert NUMERIC to cents for calculation, then back to NUMERIC for update
    const creditLimitCents = Math.round((card.credit_limit || 0) * 100);
    const newAvailableBalance = Math.max(0, creditLimitCents - totalUsed) / 100;

    await supabase
      .from('accounts')
      .update({
        available_balance: newAvailableBalance,
      })
      .eq('id', accountId);
  }
}

// Helper function to process credit card bill payment via category transaction
async function processCreditCardBillPayment(
  supabase: any,
  userId: string,
  categoryId: string,
  amountCents: number,
  paymentDate: string
) {
  // Find if this category belongs to a credit card
  const { data: creditCard } = await supabase
    .from('accounts')
    .select('id, name, category_id')
    .eq('user_id', userId)
    .eq('type', 'credit_card')
    .eq('category_id', categoryId)
    .single();

  if (!creditCard) return; // Category doesn't belong to any credit card

  // Find the current open bill for this card (or the most recent unpaid one)
  const { data: bills } = await supabase
    .from('credit_card_bills')
    .select('*')
    .eq('account_id', creditCard.id)
    .in('status', ['open', 'closed', 'partial', 'overdue'])
    .order('due_date', { ascending: true });

  if (!bills || bills.length === 0) return;

  // Apply payment to bills in order of due date
  let remainingPayment = amountCents;

  for (const bill of bills) {
    if (remainingPayment <= 0) break;

    const unpaidAmount = bill.total_cents - (bill.paid_cents || 0);
    if (unpaidAmount <= 0) continue;

    const paymentAmount = Math.min(remainingPayment, unpaidAmount);
    const newPaidCents = (bill.paid_cents || 0) + paymentAmount;
    const isFullyPaid = newPaidCents >= bill.total_cents;

    let newStatus = bill.status;
    if (isFullyPaid) {
      newStatus = 'paid';
    } else if (newPaidCents > 0) {
      newStatus = 'partial';
    }

    // Update the bill
    await supabase
      .from('credit_card_bills')
      .update({
        paid_cents: newPaidCents,
        status: newStatus,
        payment_date: isFullyPaid ? paymentDate : bill.payment_date,
      })
      .eq('id', bill.id);

    remainingPayment -= paymentAmount;
  }

  // Update the card's available limit
  await updateCreditCardBillTotals(supabase, creditCard.id);
}

// Helper function to process transactions related to investments, goals, and debts
async function processInvestmentGoalDebtTransactions(
  supabase: any,
  userId: string,
  categoryId: string | null | undefined,
  transactionId: string,
  amountCents: number,
  postedAt: string
) {
  if (!categoryId) return;

  // Check if category belongs to an investment
  const { data: investment } = await supabase
    .from('investments')
    .select('id, name, category_id')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .single();

  if (investment) {
    // Transaction with investment category
    // If expense: contribution to investment (aumenta current_value)
    // If income: withdrawal/dividend from investment (diminui current_value para saque, aumenta para dividendo)
    const amount = amountCents / 100;
    const { data: currentInvestment } = await supabase
      .from('investments')
      .select('current_value_cents, initial_investment_cents')
      .eq('id', investment.id)
      .single();

    if (currentInvestment) {
      if (amount < 0) {
        // Expense = contribution (aumenta o valor)
        const newValue = (currentInvestment.current_value_cents || currentInvestment.initial_investment_cents || 0) + Math.abs(amountCents);
        await supabase
          .from('investments')
          .update({ current_value_cents: newValue })
          .eq('id', investment.id);
      } else {
        // Income = withdrawal (diminui o valor) ou dividend (aumenta)
        // Por padrão, tratamos como saque (diminui)
        // Se for dividendo, o usuário pode ajustar manualmente ou podemos adicionar lógica mais sofisticada depois
        const newValue = Math.max(0, (currentInvestment.current_value_cents || currentInvestment.initial_investment_cents || 0) - amountCents);
        await supabase
          .from('investments')
          .update({ current_value_cents: newValue })
          .eq('id', investment.id);
      }
    }
    return;
  }

  // Check if category belongs to a goal
  const { data: goal } = await supabase
    .from('goals')
    .select('id, name, category_id')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .single();

  if (goal) {
    // Transaction with goal category
    // If expense: contribution to goal
    // If income: withdrawal from goal
    const amount = amountCents / 100;
    if (amount < 0) {
      // Expense = contribution
      // Update goal current_amount_cents
      const { data: currentGoal } = await supabase
        .from('goals')
        .select('current_amount_cents')
        .eq('id', goal.id)
        .single();

      if (currentGoal) {
        const newAmount = (currentGoal.current_amount_cents || 0) + Math.abs(amountCents);
        await supabase
          .from('goals')
          .update({ current_amount_cents: newAmount })
          .eq('id', goal.id);
      }
    } else {
      // Income = withdrawal
      const { data: currentGoal } = await supabase
        .from('goals')
        .select('current_amount_cents')
        .eq('id', goal.id)
        .single();

      if (currentGoal) {
        const newAmount = Math.max(0, (currentGoal.current_amount_cents || 0) - amountCents);
        await supabase
          .from('goals')
          .update({ current_amount_cents: newAmount })
          .eq('id', goal.id);
      }
    }
    return;
  }

  // Check if category belongs to a debt
  const { data: debt } = await supabase
    .from('debts')
    .select('id, name, category_id')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .single();

  if (debt) {
    // Transaction with debt category = payment
    // Update debt paid_amount_cents
    const { data: currentDebt } = await supabase
      .from('debts')
      .select('paid_amount_cents, total_amount_cents')
      .eq('id', debt.id)
      .single();

    if (currentDebt) {
      const paymentAmount = Math.abs(amountCents);
      const newPaidAmount = (currentDebt.paid_amount_cents || 0) + paymentAmount;
      const isFullyPaid = newPaidAmount >= (currentDebt.total_amount_cents || 0);

      await supabase
        .from('debts')
        .update({
          paid_amount_cents: newPaidAmount,
          status: isFullyPaid ? 'paid' : 'active',
        })
        .eq('id', debt.id);
    }
    return;
  }
}
