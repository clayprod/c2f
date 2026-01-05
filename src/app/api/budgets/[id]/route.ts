import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { budgetSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { projectionCache } from '@/services/projections/cache';
import { calculateMinimumBudget, formatSourcesForError } from '@/services/budgets/minimumCalculator';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const budgetId = params.id;

    // Validate input - only allow updating amount_planned for now
    if (body.amount_planned === undefined && body.limit_cents === undefined) {
      return NextResponse.json(
        { error: 'amount_planned ou limit_cents é obrigatório' },
        { status: 400 }
      );
    }

    const { supabase } = createClientFromRequest(request);

    // First, verify the budget belongs to the user
    const { data: existingBudget, error: fetchError } = await supabase
      .from('budgets')
      .select('*, categories(source_type)')
      .eq('id', budgetId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingBudget) {
      return NextResponse.json(
        { error: 'Orçamento não encontrado ou não pertence ao usuário' },
        { status: 404 }
      );
    }

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

    // Calculate amount_planned from limit_cents if provided
    let amount_planned = body.amount_planned;
    if (body.limit_cents !== undefined) {
      const limitCents = Math.round(body.limit_cents);
      if (limitCents <= 0) {
        return NextResponse.json(
          { error: 'Limite deve ser maior que zero' },
          { status: 400 }
        );
      }
      amount_planned = limitCents / 100;
    }

    // Calculate minimum amount based on automatic contributions
    const { minimum_cents, sources } = await calculateMinimumBudget(
      supabase,
      userId,
      existingBudget.category_id,
      existingBudget.year,
      existingBudget.month
    );

    const minimumAmount = minimum_cents / 100; // Convert to reais

    // Validate that new amount is not below minimum
    if (amount_planned < minimumAmount) {
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
      amount_planned: amount_planned,
    };

    // Try to add new fields (will be ignored if columns don't exist)
    // Check if columns exist by trying to update with them first
    updateData.minimum_amount_planned = minimumAmount;
    updateData.auto_contributions_cents = minimum_cents;

    // Only update optional fields if provided
    if (body.source_type !== undefined) {
      updateData.source_type = body.source_type;
    }
    if (body.is_projected !== undefined) {
      updateData.is_projected = body.is_projected;
    }

    // Update the budget - try with new fields first
    let { data, error } = await supabase
      .from('budgets')
      .update(updateData)
      .eq('id', budgetId)
      .eq('user_id', userId)
      .select('*, categories(*)')
      .single();

    // If error is about missing columns, try without them
    if (error && (error.message?.includes('auto_contributions_cents') || error.message?.includes('minimum_amount_planned') || error.code === '42703')) {
      console.log('New budget columns not found, updating without them');
      const fallbackData: any = {
        amount_planned: amount_planned,
      };
      
      if (body.source_type !== undefined) {
        fallbackData.source_type = body.source_type;
      }
      if (body.is_projected !== undefined) {
        fallbackData.is_projected = body.is_projected;
      }

      const fallbackResult = await supabase
        .from('budgets')
        .update(fallbackData)
        .eq('id', budgetId)
        .eq('user_id', userId)
        .select('*, categories(*)')
        .single();

      data = fallbackResult.data;
      error = fallbackResult.error;
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
    projectionCache.invalidateUser(userId);

    // Transform response
    const transformedData = {
      ...data,
      limit_cents: Math.round((data.amount_planned || 0) * 100),
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

    const budgetId = params.id;
    const { supabase } = createClientFromRequest(request);

    // Verify the budget belongs to the user
    const { data: existingBudget, error: fetchError } = await supabase
      .from('budgets')
      .select('id, is_auto_generated, source_type, categories(source_type)')
      .eq('id', budgetId)
      .eq('user_id', userId)
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
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Database error deleting budget:', deleteError);
      return NextResponse.json(
        { error: deleteError.message || 'Erro ao excluir orçamento' },
        { status: 500 }
      );
    }

    // Clear cache for this user
    projectionCache.invalidateUser(userId);

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

