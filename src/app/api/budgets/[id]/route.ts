import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { budgetSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { projectionCache } from '@/services/projections/cache';
import { calculateMinimumBudget, formatSourcesForError } from '@/services/budgets/minimumCalculator';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

type BudgetBreakdownItemInput = { id?: string; label: string; amount_cents: number };

function getExistingBreakdown(existingBudget: any): { enabled: boolean; items: any[] } | null {
  const meta = existingBudget?.metadata;
  const breakdown = meta?.budget_breakdown;
  if (!breakdown || typeof breakdown !== 'object') return null;
  const enabled = !!breakdown.enabled;
  const items = Array.isArray(breakdown.items) ? breakdown.items : [];
  return { enabled, items };
}

function buildBudgetBreakdownMetadata(items: BudgetBreakdownItemInput[]) {
  return {
    budget_breakdown: {
      enabled: true,
      items: items.map((it) => ({
        id: it.id,
        label: it.label,
        amount_cents: Math.round(it.amount_cents),
      })),
    },
  };
}

function sumBreakdownItemsCents(items: BudgetBreakdownItemInput[]) {
  return items.reduce((sum, it) => sum + Math.round(it.amount_cents || 0), 0);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const body = await request.json();
    const budgetId = params.id;

    // Validate input - allow updating planned amount OR breakdown_items
    if (body.limit_cents === undefined && body.amount_planned_cents === undefined && !Object.prototype.hasOwnProperty.call(body, 'breakdown_items')) {
      return NextResponse.json(
        { error: 'amount_planned_cents ou limit_cents é obrigatório' },
        { status: 400 }
      );
    }

    const { supabase } = createClientFromRequest(request);

    // First, verify the budget belongs to the user
    const { data: existingBudget, error: fetchError } = await supabase
      .from('budgets')
      .select('*, categories(source_type)')
      .eq('id', budgetId)
      .eq('user_id', ownerId)
      .single();

    if (fetchError || !existingBudget) {
      return NextResponse.json(
        { error: 'Orçamento não encontrado ou não pertence ao usuário' },
        { status: 404 }
      );
    }

    const existingBreakdown = getExistingBreakdown(existingBudget);
    const hasExistingBreakdown = !!(existingBreakdown?.enabled && existingBreakdown.items.length > 0);

    // Block editing auto-generated budgets (except for goal budgets which can be adjusted via special endpoint)
    if (existingBudget.is_auto_generated && existingBudget.source_type !== 'goal') {
      const category = existingBudget.categories as any;
      const sourceTypeLabels: Record<string, string> = {
        credit_card: 'cartão de crédito',
        debt: 'dívida',
        investment: 'investimento',
      };
      const sourceLabel = sourceTypeLabels[existingBudget.source_type] || existingBudget.source_type;
      
      return NextResponse.json(
        { 
          error: `Este orçamento é gerado automaticamente a partir de ${sourceLabel}. Não é possível editá-lo manualmente.`,
          source_type: existingBudget.source_type,
          is_auto_generated: true,
        },
        { status: 400 }
      );
    }

    // Block editing budgets for automatic categories (unless it's a goal budget which can be adjusted)
    const category = existingBudget.categories as any;
    const automaticSourceTypes = ['credit_card', 'debt', 'investment'];
    if (category?.source_type && automaticSourceTypes.includes(category.source_type) && existingBudget.source_type !== category.source_type) {
      const typeLabels: Record<string, string> = {
        credit_card: 'cartão de crédito',
        debt: 'dívida',
        investment: 'investimento',
      };
      const typeLabel = typeLabels[category.source_type] || category.source_type;
      
      return NextResponse.json(
        { 
          error: `Orçamentos de ${typeLabel} são gerados automaticamente. Não é possível editá-los manualmente.`,
          source_type: category.source_type,
        },
        { status: 400 }
      );
    }

    const breakdownItemsProvided = Object.prototype.hasOwnProperty.call(body, 'breakdown_items');
    const breakdownItems = (Array.isArray(body.breakdown_items) ? body.breakdown_items : []) as BudgetBreakdownItemInput[];
    const wantsBreakdownEnabled = breakdownItemsProvided && breakdownItems.length > 0;
    const wantsBreakdownCleared = breakdownItemsProvided && breakdownItems.length === 0;

    // Enforce force_subs: if there are existing subs, user must edit via breakdown_items (or explicitly clear them)
    if (hasExistingBreakdown && !breakdownItemsProvided) {
      return NextResponse.json(
        { error: 'Este orçamento possui sub-itens. Para alterar, edite os sub-itens.' },
        { status: 400 }
      );
    }

    // Determine amount_planned_cents
    let amountPlannedCents: number | undefined;
    if (wantsBreakdownEnabled) {
      amountPlannedCents = sumBreakdownItemsCents(breakdownItems);
    } else {
      // If clearing breakdown, fall back to direct amount
      amountPlannedCents = body.amount_planned_cents;
      if (body.limit_cents !== undefined) {
        amountPlannedCents = Math.round(body.limit_cents);
      }
    }

    if (amountPlannedCents === undefined || Math.round(amountPlannedCents) <= 0) {
      return NextResponse.json(
        { error: 'Limite deve ser maior que zero' },
        { status: 400 }
      );
    }
    amountPlannedCents = Math.round(amountPlannedCents);

    // Calculate minimum amount based on automatic contributions
    const { minimum_cents, sources } = await calculateMinimumBudget(
      supabase,
      ownerId,
      existingBudget.category_id,
      existingBudget.year,
      existingBudget.month
    );

    const minimumAmount = minimum_cents / 100; // Convert to reais

    // Validate that new amount is not below minimum
    if ((amountPlannedCents ?? 0) < minimum_cents) {
      const sourcesText = formatSourcesForError(sources);
      return NextResponse.json(
        { 
          error: `Não é possível reduzir o orçamento abaixo de ${minimumAmount.toFixed(2)}. Há contribuições automáticas que impedem esta redução.`,
          minimum_amount: minimumAmount,
          minimum_cents: minimum_cents,
          sources: sources,
          sources_text: sourcesText,
          suggestion: sourcesText 
            ? `Para reduzir, desmarque as seguintes fontes como recorrentes ou remova-as: ${sourcesText}`
            : 'Verifique as transações recorrentes, objetivos, dívidas e investimentos marcados para incluir no orçamento.'
        },
        { status: 400 }
      );
    }

    // Prepare update data - start with required field
    const updateData: any = {
      amount_planned_cents: amountPlannedCents,
    };

    // Try to add new fields (will be ignored if columns don't exist)
    // Check if columns exist by trying to update with them first
    updateData.minimum_amount_planned_cents = minimum_cents;
    updateData.auto_contributions_cents = minimum_cents;

    // Update breakdown metadata if provided
    if (wantsBreakdownEnabled) {
      updateData.metadata = buildBudgetBreakdownMetadata(breakdownItems);
    } else if (wantsBreakdownCleared) {
      // Clear breakdown by removing metadata entry (set to empty object)
      updateData.metadata = {};
    }

    // Only update optional fields if provided
    if (body.source_type !== undefined) {
      updateData.source_type = body.source_type;
    }
    if (body.is_projected !== undefined) {
      updateData.is_projected = body.is_projected;
    }

    let data: any = null;
    let error: any = null;

    // Try update with metadata; fallback if column doesn't exist
    const initialUpdate = await supabase
      .from('budgets')
      .update(updateData)
      .eq('id', budgetId)
      .eq('user_id', ownerId)
      .select('*, categories(*)')
      .single();

    data = initialUpdate.data;
    error = initialUpdate.error;

    if (error) {
      const errorMsg = error.message?.toLowerCase?.() || '';
      if (errorMsg.includes('metadata') && errorMsg.includes('column') && errorMsg.includes('does not exist')) {
        const { metadata, ...fallback } = updateData;
        const fallbackUpdate = await supabase
          .from('budgets')
          .update(fallback)
          .eq('id', budgetId)
          .eq('user_id', ownerId)
          .select('*, categories(*)')
          .single();
        data = fallbackUpdate.data;
        error = fallbackUpdate.error;
      }
    }

    if (error) {
      console.error('Database error updating budget:', error);
      
      // Check for constraint violations
      if (error.code === '23514') {
        return NextResponse.json(
          { error: 'Dados inválidos: verifique os valores informados' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message || 'Erro ao atualizar orçamento', code: error.code },
        { status: 500 }
      );
    }

    // Clear cache for this user
    projectionCache.invalidateUser(ownerId);

    // Transform response
    const transformedData = {
      ...data,
      limit_cents: data.amount_planned_cents || 0,
      amount_actual_cents: Math.round((data.amount_actual || 0) * 100),
    };

    return NextResponse.json({ data: transformedData }, { status: 200 });
  } catch (error: any) {
    console.error('Budget update error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error || 'Erro ao atualizar orçamento' },
      { status: errorResponse.statusCode || 500 }
    );
  }
}

export async function DELETE(
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
    const { supabase } = createClientFromRequest(request);

    // Verify the budget belongs to the user
    const { data: existingBudget, error: fetchError } = await supabase
      .from('budgets')
      .select('id, is_auto_generated, source_type, categories(source_type)')
      .eq('id', budgetId)
      .eq('user_id', ownerId)
      .single();

    if (fetchError || !existingBudget) {
      return NextResponse.json(
        { error: 'Orçamento não encontrado ou não pertence ao usuário' },
        { status: 404 }
      );
    }

    // Block deleting auto-generated budgets
    if (existingBudget.is_auto_generated) {
      const category = existingBudget.categories as any;
      const sourceTypeLabels: Record<string, string> = {
        credit_card: 'cartão de crédito',
        goal: 'objetivo',
        debt: 'dívida',
        investment: 'investimento',
      };
      const sourceLabel = sourceTypeLabels[existingBudget.source_type] || existingBudget.source_type;
      
      return NextResponse.json(
        { 
          error: `Este orçamento é gerado automaticamente a partir de ${sourceLabel}. Não é possível excluí-lo manualmente.`,
          source_type: existingBudget.source_type,
          is_auto_generated: true,
        },
        { status: 400 }
      );
    }

    // Delete the budget
    const { error: deleteError } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budgetId)
      .eq('user_id', ownerId);

    if (deleteError) {
      console.error('Database error deleting budget:', deleteError);
      return NextResponse.json(
        { error: deleteError.message || 'Erro ao excluir orçamento' },
        { status: 500 }
      );
    }

    // Clear cache for this user
    projectionCache.invalidateUser(ownerId);

    return NextResponse.json({ message: 'Orçamento excluído com sucesso' }, { status: 200 });
  } catch (error: any) {
    console.error('Budget delete error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error || 'Erro ao excluir orçamento' },
      { status: errorResponse.statusCode || 500 }
    );
  }
}

