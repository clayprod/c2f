import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { calculateMinimumBudget } from '@/services/budgets/minimumCalculator';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');
    const month = searchParams.get('month'); // YYYY-MM format

    if (!categoryId || !month) {
      return NextResponse.json(
        { error: 'category_id e month são obrigatórios' },
        { status: 400 }
      );
    }

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    if (isNaN(year) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { error: 'Formato de mês inválido (use YYYY-MM)' },
        { status: 400 }
      );
    }

    const { supabase } = createClientFromRequest(request);
    const { minimum_cents, sources } = await calculateMinimumBudget(
      supabase,
      ownerId,
      categoryId,
      year,
      monthNum
    );

    return NextResponse.json({
      data: {
        minimum_cents,
        minimum_amount: minimum_cents / 100,
        sources,
      },
    });
  } catch (error: any) {
    console.error('Error calculating minimum budget:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao calcular mínimo' },
      { status: 500 }
    );
  }
}



