import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '12');

    const { supabase } = createClientFromRequest(request);

    // Verify card belongs to user
    const { data: card, error: cardError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', id)
      .eq('user_id', ownerId)
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
      .eq('user_id', ownerId)
      .order('reference_month', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: bills, error } = await query;

    if (error) throw error;

    // Get all bill IDs to fetch bill items
    const billIds = (bills || []).map((b: any) => b.id);

    // Fetch bill items for all bills in one query
    let transactionsMap = new Map<string, any[]>();
    if (billIds.length > 0) {
      const { data: billItems, error: itemsError } = await supabase
        .from('credit_card_bill_items')
        .select(`
          id,
          description,
          amount_cents,
          posted_at,
          bill_id,
          category:categories(id, name, icon, color),
          installment_number,
          installment_total
        `)
        .in('bill_id', billIds)
        .eq('user_id', ownerId);

      if (itemsError) throw itemsError;

      // Group items by bill_id
      (billItems || []).forEach((item: any) => {
        const billId = item.bill_id;
        if (!transactionsMap.has(billId)) {
          transactionsMap.set(billId, []);
        }
        transactionsMap.get(billId)!.push(item);
      });
    }

    // Calculate summary for each bill
    const billsWithSummary = (bills || []).map((bill: any) => {
      const transactions = transactionsMap.get(bill.id) || [];
      const totalExpenses = transactions
        .reduce((sum: number, t: any) => sum + (t.amount_cents || 0), 0);

      return {
        ...bill,
        transaction_count: transactions.length,
        calculated_total: totalExpenses,
        transactions,
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
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { id } = await params;
    const body = await request.json();
    const { reference_month } = body;

    if (!reference_month) {
      return NextResponse.json(
        { error: 'reference_month e obrigatorio' },
        { status: 400 }
      );
    }

    const { supabase } = createClientFromRequest(request);

    // Get card details
    const { data: card, error: cardError } = await supabase
      .from('accounts')
      .select('id, closing_day, due_day')
      .eq('id', id)
      .eq('user_id', ownerId)
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
        { error: 'Já existe uma fatura para este mês' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('credit_card_bills')
      .insert({
        user_id: ownerId,
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
