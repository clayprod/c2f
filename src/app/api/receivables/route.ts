import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { receivableSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { generateAutoBudgetsForReceivable } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const order = searchParams.get('order') || 'desc';

    const { supabase } = createClientFromRequest(request);
    let query = supabase
      .from('receivables')
      .select('*, accounts(*), categories(*)')
      .eq('user_id', ownerId);

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    // Apply sorting
    const ascending = order === 'asc';
    if (sortBy === 'total_amount_cents') {
      query = query.order('total_amount_cents', { ascending });
    } else if (sortBy === 'remaining_amount_cents') {
      query = query.order('remaining_amount_cents', { ascending });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw error;

    // Recalculate received amounts from transactions for each receivable
    if (data && data.length > 0) {
      for (const receivable of data) {
        if (receivable.category_id) {
          // Sum all transactions with this category (income = receipts)
          const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', ownerId)
            .eq('category_id', receivable.category_id)
            .gt('amount', 0); // Only income (receipts)

          if (transactions) {
            const totalReceivedCents = Math.abs(
              transactions.reduce((sum: number, tx: any) => sum + (tx.amount * 100), 0)
            );
            
            // Update receivable if received amount differs
            if (totalReceivedCents !== (receivable.received_amount_cents || 0)) {
              await supabase
                .from('receivables')
                .update({ 
                  received_amount_cents: totalReceivedCents
                })
                .eq('id', receivable.id);
              
              receivable.received_amount_cents = totalReceivedCents;
              receivable.remaining_amount_cents = (receivable.total_amount_cents || 0) - totalReceivedCents;
            }
          }
        }
      }
    }

    // Amounts are already in cents (BIGINT)
    return NextResponse.json({ data });
  } catch (error) {
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

    const body = await request.json();
    const validated = receivableSchema.parse(body);

    const { supabase } = createClientFromRequest(request);

    // Create a category for this receivable (using receivable name directly)
    const categoryName = validated.name.toUpperCase();
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .insert({
        user_id: ownerId,
        name: categoryName,
        type: 'income',
        icon: '💰',
        color: '#32CD32',
        source_type: 'receivable',
      })
      .select()
      .single();

    if (categoryError) {
      console.error('Error creating receivable category:', categoryError);
    }

    const hasCustomPlan = !!validated.plan_entries && validated.plan_entries.length > 0;
    const includeInPlan = hasCustomPlan ? true : validated.include_in_plan;

    // Validate custom plan total if using custom plan
    if (hasCustomPlan && validated.plan_entries && validated.plan_entries.length > 0) {
      const totalAmount = validated.total_amount_cents;
      const receivedAmount = validated.received_amount_cents || 0;
      const remainingAmount = totalAmount - receivedAmount;
      const planTotal = validated.plan_entries.reduce((sum, entry) => sum + entry.amount_cents, 0);

      if (planTotal < remainingAmount) {
        // Log warning but don't prevent saving
        console.warn(`Receivable ${validated.name}: Plan total (${planTotal}) is less than remaining amount (${remainingAmount})`);
      }
    }

    // Create the receivable
    // Extract only the fields that exist in the database schema
    const receivableData: any = {
      user_id: ownerId,
      name: validated.name,
      description: validated.description || null,
      debtor_name: validated.debtor_name || null,
      total_amount_cents: validated.total_amount_cents,
      received_amount_cents: validated.received_amount_cents || 0,
      interest_rate: validated.interest_rate_monthly || 0,
      due_date: validated.due_date || null,
      start_date: validated.start_date || null,
      status: validated.status || 'pendente',
      priority: validated.priority || 'medium',
      account_id: validated.account_id || null,
      category_id: category?.id || validated.category_id || null,
      notes: validated.notes || null,
      payment_frequency: validated.payment_frequency || null,
      payment_amount_cents: validated.payment_amount_cents || null,
      installment_count: validated.installment_count || null,
      include_in_plan: includeInPlan ?? true,
    };

    // Add fields for plan inclusion
    if (validated.status === 'negociada') {
      receivableData.is_negotiated = true;
      receivableData.include_in_plan = includeInPlan ?? true;
      receivableData.contribution_frequency = hasCustomPlan
        ? null
        : (validated.contribution_frequency || validated.payment_frequency || null);
      receivableData.monthly_payment_cents = validated.monthly_payment_cents || validated.payment_amount_cents || null;
      receivableData.installment_amount_cents = validated.installment_amount_cents || validated.payment_amount_cents || null;
      receivableData.installment_day = validated.installment_day || null;
    } else {
      receivableData.is_negotiated = false;
      receivableData.include_in_plan = includeInPlan ?? false;
      // Allow contribution_frequency and monthly_payment_cents even if not negotiated
      if (includeInPlan && !hasCustomPlan) {
        receivableData.contribution_frequency = validated.contribution_frequency || null;
        receivableData.monthly_payment_cents = validated.monthly_payment_cents || null;
      }
    }

    const { data, error } = await supabase
      .from('receivables')
      .insert(receivableData)
      .select('*, accounts(*), categories(*)')
      .single();

    if (error) throw error;

    if (data && validated.plan_entries && validated.plan_entries.length > 0) {
      const planEntries = validated.plan_entries.map((entry) => ({
        user_id: ownerId,
        receivable_id: data.id,
        category_id: data.category_id || null,
        entry_month: `${entry.month}-01`,
        amount_cents: entry.amount_cents,
        description: `Plano personalizado - ${data.name}`,
      }));

      const { error: planError } = await supabase
        .from('receivable_plan_entries')
        .upsert(planEntries, {
          onConflict: 'receivable_id,entry_month',
        });

      if (planError) {
        console.error('Error inserting receivable plan entries:', planError);
      }
    }

    // Generate automatic budgets if include_in_plan is true and has contribution_frequency or is negotiated
    if (data.include_in_plan && data.category_id && (data.contribution_frequency || (data.is_negotiated && data.status === 'negociada'))) {
      try {
        const today = new Date();
        const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const endDate = new Date(today);
        
        // Calculate end month based on installment_count or default to 12 months
        if (data.installment_count) {
          endDate.setMonth(endDate.getMonth() + data.installment_count);
        } else {
          endDate.setMonth(endDate.getMonth() + 12);
        }
        const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

        await generateAutoBudgetsForReceivable(
          supabase,
          ownerId,
          {
            id: data.id,
            category_id: data.category_id,
            include_in_plan: data.include_in_plan,
            is_negotiated: data.is_negotiated,
            status: data.status,
            contribution_frequency: data.contribution_frequency,
            monthly_payment_cents: data.monthly_payment_cents,
            installment_count: data.installment_count,
            installment_amount_cents: data.installment_amount_cents,
            installment_day: data.installment_day,
            total_amount_cents: data.total_amount_cents,
            received_amount_cents: data.received_amount_cents || 0,
            start_date: data.start_date,
          },
          {
            startMonth,
            endMonth,
            overwrite: false,
          }
        );

        projectionCache.invalidateUser(ownerId);
      } catch (budgetError) {
        console.error('Error generating auto budgets for receivable:', budgetError);
        // Don't fail the receivable creation if budget generation fails
      }
    }

    // If adds_to_cash is true and we have a destination account, create an income transaction
    if (validated.adds_to_cash && validated.destination_account_id) {
      // Create an income category for receivables if it doesn't exist
      let receivableIncomeCategory;
      const { data: existingCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', ownerId)
        .eq('name', 'RECEBIVEIS RECEBIDOS')
        .single();

      if (existingCategory) {
        receivableIncomeCategory = existingCategory;
      } else {
        const { data: newCategory } = await supabase
          .from('categories')
          .insert({
            user_id: ownerId,
            name: 'RECEBIVEIS RECEBIDOS',
            type: 'income',
            icon: '💰',
            color: '#32CD32',
          })
          .select()
          .single();
        receivableIncomeCategory = newCategory;
      }

      // Create an income transaction for the total amount (principal)
      const principalAmount = validated.principal_amount_cents || validated.total_amount_cents;
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: ownerId,
          account_id: validated.destination_account_id,
          category_id: receivableIncomeCategory?.id,
          posted_at: validated.start_date || new Date().toISOString().split('T')[0],
          description: `Recebível: ${validated.name}`,
          amount_cents: principalAmount, // Positive = income
          currency: 'BRL',
          source: 'manual',
          notes: `Valor recebido do recebível: ${validated.name}`,
        });

      if (txError) {
        console.error('Error creating receivable income transaction:', txError);
      }

      // Update account balance
      const { data: account } = await supabase
        .from('accounts')
        .select('current_balance')
        .eq('id', validated.destination_account_id)
        .single();

      if (account) {
        // Convert cents to NUMERIC for calculation
        const currentBalance = parseFloat(account.current_balance || 0);
        const newBalance = currentBalance + (principalAmount / 100);
        await supabase
          .from('accounts')
          .update({
            current_balance: newBalance,
          })
          .eq('id', validated.destination_account_id);
      }
    }

    return NextResponse.json({
      data: {
        ...data,
        category_id: category?.id,
        category_name: category?.name,
      }
    }, { status: 201 });
  } catch (error) {
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
