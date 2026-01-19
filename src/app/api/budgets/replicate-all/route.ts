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

    const { month, overwrite = false, months, end_month } = body;

    if (!month || !month.match(/^\d{4}-\d{2}$/)) {
      return NextResponse.json(
        { error: 'Mês inválido (use YYYY-MM)' },
        { status: 400 }
      );
    }

    const { supabase } = createClientFromRequest(request);

    // Get all manual budgets for the specified month
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    // Get all manual budgets - try with OR first, fallback if columns don't exist
    let sourceBudgets;
    let fetchError;
    
    const { data: budgetsWithOr, error: errorWithOr } = await supabase
      .from('budgets')
      .select('*, categories(*)')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', monthNum)
      .or('source_type.is.null,source_type.eq.manual')
      .eq('is_projected', false);
    
    if (errorWithOr) {
      // If OR fails (maybe columns don't exist), try without filters
      const { data: allBudgets, error: allError } = await supabase
        .from('budgets')
        .select('*, categories(*)')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', monthNum);
      
      if (allError) {
        fetchError = allError;
        sourceBudgets = null;
      } else {
        // Filter manually - only manual budgets
        sourceBudgets = (allBudgets || []).filter((b: any) => 
          (!b.source_type || b.source_type === 'manual') && !b.is_projected
        );
        fetchError = null;
      }
    } else {
      sourceBudgets = budgetsWithOr;
      fetchError = errorWithOr;
    }

    if (fetchError) {
      console.error('Error fetching budgets:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar orçamentos' },
        { status: 500 }
      );
    }

    if (!sourceBudgets || sourceBudgets.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum orçamento manual encontrado para este mês' },
        { status: 404 }
      );
    }

    // Calculate target months based on provided parameters
    const sourceDate = new Date(year, monthNum - 1, 1);
    let targetDate: Date;
    
    if (end_month && end_month.match(/^\d{4}-\d{2}$/)) {
      // Replicate until specific month/year
      const [endYearStr, endMonthStr] = end_month.split('-');
      targetDate = new Date(parseInt(endYearStr, 10), parseInt(endMonthStr, 10) - 1, 1);
      
      // Validate: cannot be in the past or more than 5 years ahead
      const maxDate = new Date(sourceDate);
      maxDate.setFullYear(maxDate.getFullYear() + MAX_REPLICATION_YEARS);
      maxDate.setMonth(11, 31); // Last day of December in the 5th year
      
      if (targetDate <= sourceDate) {
        return NextResponse.json(
          { error: 'Data final deve ser posterior ao mês de origem' },
          { status: 400 }
        );
      }
      
      if (targetDate > maxDate) {
        return NextResponse.json(
          { error: `Data final não pode ultrapassar ${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}` },
          { status: 400 }
        );
      }
    } else if (months && typeof months === 'number' && months > 0) {
      // Replicate for specific number of months (max 60 = 5 years)
      const maxMonths = MAX_REPLICATION_YEARS * 12;
      if (months > maxMonths) {
        return NextResponse.json(
          { error: `Número de meses não pode ultrapassar ${maxMonths} (${MAX_REPLICATION_YEARS} anos)` },
          { status: 400 }
        );
      }
      targetDate = new Date(sourceDate);
      targetDate.setMonth(targetDate.getMonth() + months);
    } else {
      // Default: replicate for 5 years
      targetDate = new Date(sourceDate);
      targetDate.setFullYear(targetDate.getFullYear() + MAX_REPLICATION_YEARS);
      targetDate.setMonth(11, 31); // Last day of December in the 5th year
    }

    const targetMonths: { year: number; month: number }[] = [];
    let current = new Date(sourceDate);
    current.setMonth(current.getMonth() + 1); // Start from next month

    while (current <= targetDate) {
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

    // Check existing budgets for all categories
    const existingBudgetsMap = new Map<string, Set<string>>(); // category_id -> Set of "year-month"
    
    if (!overwrite) {
      const uniqueYears = [...new Set(targetMonths.map(tm => tm.year))];
      const categoryIds = sourceBudgets.map(b => b.category_id);

      if (categoryIds.length > 0 && uniqueYears.length > 0) {
        const { data: existing, error: existingError } = await supabase
          .from('budgets')
          .select('category_id, year, month')
          .eq('user_id', userId)
          .in('category_id', categoryIds)
          .in('year', uniqueYears);

        if (existingError) {
          console.error('Error checking existing budgets:', existingError);
        } else if (existing) {
          for (const budget of existing) {
            const key = `${budget.year}-${budget.month}`;
            if (!existingBudgetsMap.has(budget.category_id)) {
              existingBudgetsMap.set(budget.category_id, new Set());
            }
            existingBudgetsMap.get(budget.category_id)!.add(key);
          }
        }
      }
    }

    // Prepare budgets to insert/update
    const hasNewColumns = sourceBudgets[0] && 'source_type' in sourceBudgets[0];
    const budgetsToUpsert: any[] = [];
    let totalCreated = 0;
    let totalOverwritten = 0;
    let totalSkipped = 0;

    for (const sourceBudget of sourceBudgets) {
      const categoryId = sourceBudget.category_id;
      const existingForCategory = existingBudgetsMap.get(categoryId) || new Set();

      for (const { year: targetYear, month: targetMonth } of targetMonths) {
        const targetKey = `${targetYear}-${targetMonth}`;
        const exists = existingForCategory.has(targetKey);

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
          category_id: categoryId,
          year: targetYear,
          month: targetMonth,
          amount_planned_cents: sourceBudget.amount_planned_cents || 0,
          amount_actual: 0,
        };

        // Copy metadata (e.g., budget_breakdown) if present
        if (sourceBudget.metadata) {
          budget.metadata = sourceBudget.metadata;
        }

        if (hasNewColumns) {
          budget.source_type = 'manual';
          budget.is_projected = false;
        }

        budgetsToUpsert.push(budget);
      }
    }

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
        total: sourceBudgets.length * targetMonths.length,
        budgets_replicated: sourceBudgets.length,
        months_replicated: targetMonths.length,
      },
    });
  } catch (error: any) {
    console.error('Budget replicate-all error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error || 'Erro ao replicar orçamentos' },
      { status: errorResponse.statusCode || 500 }
    );
  }
}


