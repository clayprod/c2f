import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { projectionCache } from '@/services/projections/cache';

const MAX_REPLICATION_YEARS = 5;

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Corpo da requisição inválido' },
        { status: 400 }
      );
    }

    const { category_id, start_month, end_month, initial_amount_cents, overwrite = false } = body;

    // Validate required fields
    if (!category_id) {
      return NextResponse.json(
        { error: 'ID da categoria é obrigatório' },
        { status: 400 }
      );
    }

    if (!start_month || !start_month.match(/^\d{4}-\d{2}$/)) {
      return NextResponse.json(
        { error: 'Data inicial inválida (use YYYY-MM)' },
        { status: 400 }
      );
    }

    if (!end_month || !end_month.match(/^\d{4}-\d{2}$/)) {
      return NextResponse.json(
        { error: 'Data final inválida (use YYYY-MM)' },
        { status: 400 }
      );
    }

    const { supabase } = createClientFromRequest(request);

    // Validate category exists and is not automatic
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, name, source_type')
      .eq('id', category_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (categoryError) {
      console.error('Error fetching category:', categoryError);
      return NextResponse.json(
        { error: 'Erro ao buscar categoria' },
        { status: 500 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: 'Categoria não encontrada ou não pertence ao usuário' },
        { status: 404 }
      );
    }

    // Block automatic categories (credit_card, investment, debt, goal)
    if (category.source_type === 'credit_card' || 
        category.source_type === 'investment' || 
        category.source_type === 'debt' || 
        category.source_type === 'goal') {
      return NextResponse.json(
        { error: `Categorias ${category.source_type} são automáticas e não permitem orçamentação manual. Apenas categorias gerais podem ser replicadas.` },
        { status: 400 }
      );
    }

    // Parse dates
    const [startYearStr, startMonthStr] = start_month.split('-');
    const [endYearStr, endMonthStr] = end_month.split('-');
    const startYear = parseInt(startYearStr, 10);
    const startMonthNum = parseInt(startMonthStr, 10);
    const endYear = parseInt(endYearStr, 10);
    const endMonthNum = parseInt(endMonthStr, 10);

    const startDate = new Date(startYear, startMonthNum - 1, 1);
    const endDate = new Date(endYear, endMonthNum - 1, 1);

    // Validate dates
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'Data final deve ser posterior à data inicial' },
        { status: 400 }
      );
    }

    // Validate 5 year limit
    const maxDate = new Date(startDate);
    maxDate.setFullYear(maxDate.getFullYear() + MAX_REPLICATION_YEARS);
    maxDate.setMonth(11, 31); // Last day of December in the 5th year

    if (endDate > maxDate) {
      return NextResponse.json(
        { error: `Data final não pode ultrapassar ${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')} (5 anos a partir da data inicial)` },
        { status: 400 }
      );
    }

    // Determine amount to use
    let amountToUse: number;
    let recentBudget: any | null = null;
    
    if (initial_amount_cents && typeof initial_amount_cents === 'number' && initial_amount_cents > 0) {
      // Use provided amount (cents)
      amountToUse = initial_amount_cents;
    } else {
      // Try to find any recent budget for this category
      // Search from most recent budget backwards
      const { data, error: budgetError } = await supabase
        .from('budgets')
        .select('amount_planned_cents, year, month, metadata')
        .eq('user_id', userId)
        .eq('category_id', category_id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (budgetError) {
        console.error('Error fetching recent budget:', budgetError);
        return NextResponse.json(
          { error: 'Erro ao buscar orçamento existente. Forneça um valor inicial (initial_amount_cents).' },
          { status: 500 }
        );
      }

      recentBudget = data;

      if (!recentBudget) {
        return NextResponse.json(
          { error: 'Não há orçamento para esta categoria. Forneça um valor inicial (initial_amount_cents).' },
          { status: 400 }
        );
      }

      amountToUse = Math.abs(recentBudget.amount_planned_cents || 0);
    }

    if (amountToUse <= 0) {
      return NextResponse.json(
        { error: 'Valor do orçamento deve ser maior que zero' },
        { status: 400 }
      );
    }

    // Generate target months from start_month to end_month (inclusive)
    const targetMonths: { year: number; month: number }[] = [];
    let current = new Date(startDate);

    while (current <= endDate) {
      targetMonths.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1,
      });
      current.setMonth(current.getMonth() + 1);
    }

    if (targetMonths.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum mês válido para replicar' },
        { status: 400 }
      );
    }

    // Check existing budgets
    const existingBudgetsMap = new Set<string>(); // Set of "year-month"
    
    if (!overwrite && targetMonths.length > 0) {
      const uniqueYears = [...new Set(targetMonths.map(tm => tm.year))];

      if (uniqueYears.length > 0) {
        const { data: existing, error: existingError } = await supabase
          .from('budgets')
          .select('year, month')
          .eq('user_id', userId)
          .eq('category_id', category_id)
          .in('year', uniqueYears);

        if (existingError) {
          console.error('Error checking existing budgets:', existingError);
        } else if (existing) {
          for (const budget of existing) {
            const key = `${budget.year}-${budget.month}`;
            existingBudgetsMap.add(key);
          }
        }
      }
    }

    // Prepare budgets to insert/update
    const budgetsToUpsert: any[] = [];
    let totalCreated = 0;
    let totalOverwritten = 0;
    let totalSkipped = 0;

    const shouldCopyMetadata = !(initial_amount_cents && typeof initial_amount_cents === 'number' && initial_amount_cents > 0);
    const metadataToCopy = shouldCopyMetadata ? (recentBudget as any)?.metadata : undefined;

    for (const { year: targetYear, month: targetMonth } of targetMonths) {
      const targetKey = `${targetYear}-${targetMonth}`;
      const exists = existingBudgetsMap.has(targetKey);

      if (exists && !overwrite) {
        totalSkipped++;
        continue;
      }

      if (exists && overwrite) {
        totalOverwritten++;
      } else {
        totalCreated++;
      }

      const budget: any = {
        user_id: userId,
        category_id: category_id,
        year: targetYear,
        month: targetMonth,
        amount_planned_cents: amountToUse,
        amount_actual: 0,
        source_type: 'manual',
        is_projected: false,
      };

      // Copy metadata (e.g., budget_breakdown) only when using existing budget as base (not when forcing a custom amount)
      if (metadataToCopy) {
        budget.metadata = metadataToCopy;
      }

      budgetsToUpsert.push(budget);
    }

    // Insert or upsert budgets
    if (budgetsToUpsert.length > 0) {
      if (overwrite) {
        const { error: upsertError } = await supabase
          .from('budgets')
          .upsert(budgetsToUpsert, {
            onConflict: 'user_id,category_id,year,month',
          });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          const errorMsg = upsertError.message?.toLowerCase() || '';
          if (errorMsg.includes('source_type') || errorMsg.includes('is_projected') ||
              errorMsg.includes('metadata') ||
              (errorMsg.includes('column') && errorMsg.includes('does not exist'))) {
            const fallbackBudgets = budgetsToUpsert.map((budget: any) => {
              const { source_type, is_projected, metadata, ...rest } = budget;
              return rest;
            });
            const { error: fallbackError } = await supabase
              .from('budgets')
              .upsert(fallbackBudgets, {
                onConflict: 'user_id,category_id,year,month',
              });
            if (fallbackError) throw fallbackError;
          } else {
            throw upsertError;
          }
        }
      } else {
        const { error: insertError } = await supabase
          .from('budgets')
          .insert(budgetsToUpsert);

        if (insertError) {
          console.error('Insert error:', insertError);
          const errorMsg = insertError.message?.toLowerCase() || '';
          if (errorMsg.includes('source_type') || errorMsg.includes('is_projected') ||
              errorMsg.includes('metadata') ||
              (errorMsg.includes('column') && errorMsg.includes('does not exist'))) {
            const fallbackBudgets = budgetsToUpsert.map((budget: any) => {
              const { source_type, is_projected, metadata, ...rest } = budget;
              return rest;
            });
            const { error: fallbackError } = await supabase
              .from('budgets')
              .insert(fallbackBudgets);
            if (fallbackError) throw fallbackError;
          } else {
            throw insertError;
          }
        }
      }
    }

    // Invalidate cache for this user
    projectionCache.invalidateUser(userId);

    return NextResponse.json({
      data: {
        created: totalCreated,
        overwritten: totalOverwritten,
        skipped: totalSkipped,
        months_replicated: targetMonths.length,
        category_name: category.name,
        amount_used: amountToUse,
      },
    });
  } catch (error: any) {
    console.error('Budget replicate-category error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error || 'Erro ao replicar orçamento' },
      { status: errorResponse.statusCode || 500 }
    );
  }
}

