import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { transactionSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const categoryId = searchParams.get('category_id');
    const search = searchParams.get('search');
    const type = searchParams.get('type'); // 'income' or 'expense'
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = await createClient();
    let query = supabase
      .from('transactions')
      .select('*, accounts(*), categories(*)', { count: 'exact' })
      .eq('user_id', userId)
      .order('posted_at', { ascending: false })
      .range(offset, offset + limit - 1);

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
      query = query.gte('posted_at', fromDate);
    }
    if (toDate) {
      query = query.lte('posted_at', toDate);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({ 
      data: data || [],
      count: count || 0,
      limit,
      offset 
    });
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
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = transactionSchema.parse(body);

    const supabase = await createClient();

    // Determine amount sign based on type if provided
    let amount = validated.amount_cents / 100;
    if (validated.type === 'expense' && amount > 0) {
      amount = -amount;
    } else if (validated.type === 'income' && amount < 0) {
      amount = Math.abs(amount);
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        account_id: validated.account_id,
        category_id: validated.category_id || null,
        posted_at: validated.posted_at,
        description: validated.description,
        amount: amount,
        currency: validated.currency,
        notes: validated.notes || null,
        user_id: userId,
        // Extended fields
        source: validated.source || 'manual',
        provider_tx_id: validated.provider_tx_id || null,
        is_recurring: validated.is_recurring || false,
        recurrence_rule: validated.recurrence_rule || null,
        installment_number: validated.installment_number || null,
        installment_total: validated.installment_total || null,
      })
      .select('*, accounts(*), categories(*)')
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
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

