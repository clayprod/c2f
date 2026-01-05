import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '12');

    const supabase = await createClient();

    // Verify card belongs to user
    const { data: card, error: cardError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('type', 'credit_card')
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });
    }

    // Build query for bills
    let query = supabase
      .from('credit_card_bills')
      .select('*')
      .eq('account_id', id)
      .eq('user_id', userId)
      .order('reference_month', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: bills, error } = await query;

    if (error) throw error;

    // Get all bill IDs to fetch transactions
    const billIds = (bills || []).map((b: any) => b.id);

    // Fetch transactions for all bills in one query
    let transactionsMap = new Map<string, any[]>();
    if (billIds.length > 0) {
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select(`
          id,
          description,
          amount,
          posted_at,
          credit_card_bill_id,
          category:categories(id, name, icon, color),
          installment_number,
          installment_total
        `)
        .in('credit_card_bill_id', billIds)
        .eq('user_id', userId);

      if (txError) throw txError;

      // Group transactions by bill_id
      (transactions || []).forEach((tx: any) => {
        const billId = tx.credit_card_bill_id;
        if (!transactionsMap.has(billId)) {
          transactionsMap.set(billId, []);
        }
        transactionsMap.get(billId)!.push(tx);
      });
    }

    // Calculate summary for each bill
    const billsWithSummary = (bills || []).map((bill: any) => {
      const transactions = transactionsMap.get(bill.id) || [];
      // Convert NUMERIC amount to cents and filter expenses (negative amounts)
      const totalExpenses = transactions
        .filter((t: any) => (t.amount || 0) < 0)
        .reduce((sum: number, t: any) => sum + Math.abs(Math.round((t.amount || 0) * 100)), 0);

      return {
        ...bill,
        transaction_count: transactions.length,
        calculated_total: totalExpenses,
        // Transform transactions to include amount_cents for consistency
        transactions: transactions.map((t: any) => ({
          ...t,
          amount_cents: Math.round((t.amount || 0) * 100),
        })),
      };
    });

    return NextResponse.json({ data: billsWithSummary });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reference_month } = body;

    if (!reference_month) {
      return NextResponse.json(
        { error: 'reference_month e obrigatorio' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get card details
    const { data: card, error: cardError } = await supabase
      .from('accounts')
      .select('id, closing_day, due_day')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('type', 'credit_card')
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });
    }

    // Calculate dates for this bill
    const refDate = new Date(reference_month + '-01');
    const closingDate = new Date(refDate.getFullYear(), refDate.getMonth(), card.closing_day);
    const dueDate = new Date(refDate.getFullYear(), refDate.getMonth(), card.due_day);

    // Check if bill already exists
    const { data: existingBill } = await supabase
      .from('credit_card_bills')
      .select('id')
      .eq('account_id', id)
      .eq('reference_month', reference_month + '-01')
      .single();

    if (existingBill) {
      return NextResponse.json(
        { error: 'Ja existe uma fatura para este mes' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('credit_card_bills')
      .insert({
        user_id: userId,
        account_id: id,
        reference_month: reference_month + '-01',
        closing_date: closingDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        status: 'open',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
