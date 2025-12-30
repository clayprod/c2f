import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { debtSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('debts')
      .select('*, accounts(*), categories(*), debt_payments(*)')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
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
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = debtSchema.partial().parse(body);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('debts')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('user_id', userId)
      .select('*, accounts(*), categories(*)')
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', params.id)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ message: 'Debt deleted successfully' });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

