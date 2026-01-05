import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { calculateMinimumBudget } from '@/services/budgets/minimumCalculator';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const supabase = await createClient();
    const { minimum_cents, sources } = await calculateMinimumBudget(
      supabase,
      userId,
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


