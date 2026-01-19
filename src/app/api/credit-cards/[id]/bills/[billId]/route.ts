import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { creditCardBillPaymentSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; billId: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, billId } = await params;
    const ownerId = await getEffectiveOwnerId(request, userId);
    const { supabase } = createClientFromRequest(request);

    // Get bill first
    const { data: billData, error: billError } = await supabase
      .from('credit_card_bills')
      .select(`
        *,
        card:accounts!credit_card_bills_account_id_fkey(
          id,
          name,
          color,
          icon
        )
      `)
      .eq('id', billId)
      .eq('account_id', id)
      .eq('user_id', ownerId)
      .single();

    if (billError) throw billError;
    if (!billData) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
    }

    // Get transactions for this bill separately
    const { data: billTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .select(`
        id,
        description,
        amount,
        posted_at,
        category:categories(id, name, icon, color),
        installment_number,
        installment_total,
        notes
      `)
      .eq('credit_card_bill_id', billId)
      .eq('user_id', ownerId);

    if (transactionsError) throw transactionsError;

    // Combine bill with transactions
    const data = {
      ...billData,
      transactions: billTransactions || [],
    };

    // Group transactions by category
    const transactions = data.transactions || [];
    const categoryTotals: Record<string, { name: string; icon: string; color: string; total: number; count: number }> = {};

    transactions.forEach((t: any) => {
      const catId = t.category?.id || 'uncategorized';
      const catName = t.category?.name || 'Sem categoria';
      const catIcon = t.category?.icon || '📝';
      const catColor = t.category?.color || '#6b7280';

      if (!categoryTotals[catId]) {
        categoryTotals[catId] = { name: catName, icon: catIcon, color: catColor, total: 0, count: 0 };
      }
      // Convert NUMERIC to cents
      const amountCents = Math.round(Math.abs(t.amount || 0) * 100);
      categoryTotals[catId].total += amountCents;
      categoryTotals[catId].count += 1;
    });

    return NextResponse.json({
      data: {
        ...data,
        category_breakdown: Object.entries(categoryTotals).map(([id, info]) => ({
          category_id: id,
          ...info,
        })),
      }
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; billId: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, billId } = await params;
    const body = await request.json();
    const ownerId = await getEffectiveOwnerId(request, userId);
    const { supabase } = createClientFromRequest(request);

    // Check if this is a payment action
    if (body.action === 'pay') {
      const validated = creditCardBillPaymentSchema.parse(body);

      // Get current bill
      const { data: bill, error: billError } = await supabase
        .from('credit_card_bills')
        .select('*')
        .eq('id', billId)
        .eq('account_id', id)
        .eq('user_id', ownerId)
        .single();

      if (billError || !bill) {
        return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
      }

      const newPaidAmount = bill.paid_cents + validated.amount_cents;
      const newStatus = newPaidAmount >= bill.total_cents ? 'paid' : 'partial';

      // Update the bill
      const { data: updatedBill, error: updateError } = await supabase
        .from('credit_card_bills')
        .update({
          paid_cents: newPaidAmount,
          status: newStatus,
          payment_date: validated.payment_date,
        })
        .eq('id', billId)
        .select()
        .single();

      if (updateError) throw updateError;

      // If payment comes from an account, create a transaction
      if (validated.from_account_id) {
        // Get the card name for transaction description
        const { data: card } = await supabase
          .from('accounts')
          .select('name')
          .eq('id', id)
          .single();

        // Get the credit card invoice category
        const { data: category } = await supabase
          .from('categories')
          .select('id')
        .eq('user_id', ownerId)
          .ilike('name', '%FATURA%CART%')
          .single();

        // Convert cents to NUMERIC for database
        await supabase
          .from('transactions')
          .insert({
            user_id: ownerId,
            account_id: validated.from_account_id,
            category_id: category?.id,
            posted_at: validated.payment_date,
            description: `Pagamento fatura ${card?.name || 'Cartao'}`,
            amount: -validated.amount_cents / 100, // Negative because it's an expense, convert cents to NUMERIC
            currency: 'BRL',
            source: 'manual',
          });

        // Update source account balance
        const { data: sourceAccount } = await supabase
          .from('accounts')
          .select('current_balance')
          .eq('id', validated.from_account_id)
          .single();

        if (sourceAccount) {
          // Convert cents to NUMERIC for update
          const currentBalance = parseFloat(sourceAccount.current_balance || 0);
          const newBalance = currentBalance - (validated.amount_cents / 100);
          await supabase
            .from('accounts')
            .update({
              current_balance: newBalance,
            })
            .eq('id', validated.from_account_id);
        }
      }

      // Update card available limit (payment increases available limit)
      const { data: cardData } = await supabase
        .from('accounts')
        .select('available_balance, credit_limit')
        .eq('id', id)
        .single();

      if (cardData) {
        // Convert NUMERIC to cents for calculation, then back to NUMERIC for update
        const creditLimitCents = Math.round((cardData.credit_limit || 0) * 100);
        const availableBalanceCents = Math.round((cardData.available_balance || 0) * 100);
        const newAvailableCents = Math.min(
          creditLimitCents,
          availableBalanceCents + validated.amount_cents
        );
        await supabase
          .from('accounts')
          .update({ available_balance: newAvailableCents / 100 })
          .eq('id', id);
      }

      return NextResponse.json({ data: updatedBill });
    }

    // Handle interest accumulation action (close bill and carry interest to next)
    if (body.action === 'close_with_interest') {
      // Get current bill
      const { data: bill, error: billError } = await supabase
        .from('credit_card_bills')
        .select('*')
        .eq('id', billId)
        .eq('account_id', id)
        .eq('user_id', ownerId)
        .single();

      if (billError || !bill) {
        return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
      }

      // Calculate unpaid amount
      const unpaidAmount = bill.total_cents - (bill.paid_cents || 0);

      if (unpaidAmount > 0) {
        // Calculate interest on unpaid amount (use provided rate or default to 0)
        const interestRate = body.interest_rate || 0;
        const interestAmount = Math.round(unpaidAmount * (interestRate / 100));

        // Update current bill as closed/overdue with interest
        await supabase
          .from('credit_card_bills')
          .update({
            status: bill.paid_cents > 0 ? 'partial' : 'overdue',
            interest_cents: interestAmount,
            interest_rate_applied: interestRate,
          })
          .eq('id', billId);

        // Find or create next month's bill
        const currentMonth = new Date(bill.reference_month);
        const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        const nextMonthStr = nextMonth.toISOString().split('T')[0];

        const { data: nextBill } = await supabase
          .from('credit_card_bills')
          .select('id, previous_balance_cents')
          .eq('account_id', id)
          .eq('reference_month', nextMonthStr)
          .single();

        // Amount to carry over: unpaid balance + interest
        const carryOverAmount = unpaidAmount + interestAmount;

        if (nextBill) {
          // Update existing next bill with carried over balance
          await supabase
            .from('credit_card_bills')
            .update({
              previous_balance_cents: carryOverAmount,
            })
            .eq('id', nextBill.id);
        } else {
          // Create next month's bill with carried over balance
          const { data: card } = await supabase
            .from('accounts')
            .select('closing_day, due_day')
            .eq('id', id)
            .single();

          const closingDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), card?.closing_day || 10);
          const dueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), card?.due_day || 15);

          await supabase
            .from('credit_card_bills')
            .insert({
              user_id: ownerId,
              account_id: id,
              reference_month: nextMonthStr,
              closing_date: closingDate.toISOString().split('T')[0],
              due_date: dueDate.toISOString().split('T')[0],
              previous_balance_cents: carryOverAmount,
              total_cents: carryOverAmount,
              status: 'open',
            });
        }
      }

      // Return updated bill
      const { data: updatedBill } = await supabase
        .from('credit_card_bills')
        .select('*')
        .eq('id', billId)
        .single();

      return NextResponse.json({ data: updatedBill });
    }

    // Regular update (status change, interest adjustment, etc.)
    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.total_cents !== undefined) updateData.total_cents = body.total_cents;
    if (body.minimum_payment_cents !== undefined) updateData.minimum_payment_cents = body.minimum_payment_cents;
    if (body.interest_cents !== undefined) updateData.interest_cents = body.interest_cents;
    if (body.interest_rate_applied !== undefined) updateData.interest_rate_applied = body.interest_rate_applied;
    if (body.previous_balance_cents !== undefined) updateData.previous_balance_cents = body.previous_balance_cents;

    const { data, error } = await supabase
      .from('credit_card_bills')
      .update(updateData)
      .eq('id', billId)
      .eq('account_id', id)
      .eq('user_id', ownerId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
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
