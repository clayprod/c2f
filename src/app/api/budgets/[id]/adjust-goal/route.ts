import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { recalculateGoalBudgets } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';
import { z } from 'zod';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

const adjustGoalBudgetSchema = z.object({
  amount_planned_cents: z.number().int().positive('Valor deve ser positivo').optional(),
  limit_cents: z.number().int().positive('Valor deve ser positivo').optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const budgetId = params.id;
    const body = await request.json();
    const validated = adjustGoalBudgetSchema.parse(body);

    const { supabase } = createClientFromRequest(request);

    // Get the budget and verify it belongs to a goal
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .select('*, categories(source_type)')
      .eq('id', budgetId)
      .eq('user_id', ownerId)
      .single();

    if (budgetError || !budget) {
      return NextResponse.json(
        { error: 'Orçamento não encontrado ou não pertence ao usuário' },
        { status: 404 }
      );
    }

    // Verify it's a goal budget
    if (budget.source_type !== 'goal') {
      return NextResponse.json(
        { error: 'Este endpoint só pode ser usado para ajustar orçamentos de objetivos' },
        { status: 400 }
      );
    }

    if (!budget.source_id) {
      return NextResponse.json(
        { error: 'Orçamento não está vinculado a um objetivo' },
        { status: 400 }
      );
    }

    // Calculate new amount
    let newAmountCents: number;
    if (validated.limit_cents !== undefined) {
      newAmountCents = validated.limit_cents;
    } else if (validated.amount_planned_cents !== undefined) {
      newAmountCents = validated.amount_planned_cents;
    } else {
      return NextResponse.json(
        { error: 'amount_planned_cents ou limit_cents é obrigatório' },
        { status: 400 }
      );
    }

    if (newAmountCents <= 0) {
      return NextResponse.json(
        { error: 'Valor deve ser maior que zero' },
        { status: 400 }
      );
    }

    // Update the budget
    const monthKey = `${budget.year}-${String(budget.month).padStart(2, '0')}`;
    const { error: updateError } = await supabase
      .from('budgets')
      .update({
        amount_planned_cents: newAmountCents,
      })
      .eq('id', budgetId)
      .eq('user_id', ownerId);

    if (updateError) {
      console.error('Error updating budget:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar orçamento' },
        { status: 500 }
      );
    }

    // Recalculate future budgets for this goal
    const { updated } = await recalculateGoalBudgets(
      supabase,
      ownerId,
      budget.source_id,
      monthKey,
      newAmountCents
    );

    // Invalidate cache
    projectionCache.invalidateUser(ownerId);

    return NextResponse.json({
      message: 'Orçamento ajustado e meses subsequentes recalculados',
      data: {
        budget_id: budgetId,
        new_amount_cents: newAmountCents,
        months_recalculated: updated,
      },
    });
  } catch (error: any) {
    console.error('Error adjusting goal budget:', error);
    
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      const zodError = error as any;
      const firstError = zodError.errors?.[0];
      const errorMessage = firstError?.message || 'Erro de validação';
      return NextResponse.json(
        { error: errorMessage, details: zodError.errors },
        { status: 400 }
      );
    }

    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error || 'Erro ao ajustar orçamento do objetivo' },
      { status: errorResponse.statusCode || 500 }
    );
  }
}


