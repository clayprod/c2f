import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { budgetReplicateSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { projectionCache } from '@/services/projections/cache';

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

    const validated = budgetReplicateSchema.parse(body);

    const { supabase } = createClientFromRequest(request);

    // Get the source budget
    const { data: sourceBudget, error: fetchError } = await supabase
      .from('budgets')
      .select('*, categories(*)')
      .eq('id', validated.budget_id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !sourceBudget) {
      return NextResponse.json(
        { error: 'Orçamento não encontrado ou não pertence ao usuário' },
        { status: 404 }
      );
    }

    // Only allow replicating manual budgets (if source_type exists)
    if (sourceBudget.source_type && sourceBudget.source_type !== 'manual') {
      return NextResponse.json(
        { error: 'Apenas orçamentos manuais podem ser replicados' },
        { status: 400 }
      );
    }

    // Calculate target months
    const sourceDate = new Date(sourceBudget.year, sourceBudget.month - 1, 1);
    const targetMonths: { year: number; month: number }[] = [];
    
    // Limit to 5 years from source date (60 months)
    const maxDate = new Date(sourceDate);
    maxDate.setFullYear(maxDate.getFullYear() + 5);
    maxDate.setMonth(11, 31); // Last day of December in the 5th year

    if (validated.months) {
      // Replicate for N months forward (limited to 5 years)
      const maxMonths = 60; // 5 years
      const monthsToReplicate = Math.min(validated.months, maxMonths);
      
      for (let i = 1; i <= monthsToReplicate; i++) {
        const targetDate = new Date(sourceDate);
        targetDate.setMonth(targetDate.getMonth() + i);
        
        // Stop if exceeds 5 years
        if (targetDate > maxDate) break;
        
        targetMonths.push({
          year: targetDate.getFullYear(),
          month: targetDate.getMonth() + 1,
        });
      }
    } else if (validated.end_month) {
      // Replicate until end_month (limited to 5 years)
      const [endYear, endMonth] = validated.end_month.split('-').map(Number);
      const endDate = new Date(endYear, endMonth - 1, 1);
      
      // Use the earlier of endDate or maxDate
      const finalEndDate = endDate > maxDate ? maxDate : endDate;
      
      let current = new Date(sourceDate);
      current.setMonth(current.getMonth() + 1); // Start from next month

      while (current <= finalEndDate) {
        targetMonths.push({
          year: current.getFullYear(),
          month: current.getMonth() + 1,
        });
        current.setMonth(current.getMonth() + 1);
      }
    }

    if (targetMonths.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum mês válido para replicar' },
        { status: 400 }
      );
    }

    // Check existing budgets
    const existingBudgets: { year: number; month: number }[] = [];
    if (!validated.overwrite && targetMonths.length > 0) {
      // Build query to check for existing budgets
      // We need to check each year-month combination
      const yearMonths = targetMonths.map(tm => `${tm.year}-${tm.month}`);
      
      // Get unique years to optimize query
      const uniqueYears = [...new Set(targetMonths.map(tm => tm.year))];
      
      let existing = null;
      let existingError = null;
      
      if (uniqueYears.length > 0) {
        const result = await supabase
          .from('budgets')
          .select('year, month')
          .eq('user_id', userId)
          .eq('category_id', sourceBudget.category_id)
          .in('year', uniqueYears);
        
        existing = result.data;
        existingError = result.error;
      }

      if (existingError) {
        console.error('Error checking existing budgets:', existingError);
        throw existingError;
      }

      if (existing) {
        for (const budget of existing) {
          const budgetKey = `${budget.year}-${budget.month}`;
          if (yearMonths.includes(budgetKey)) {
            existingBudgets.push({ year: budget.year, month: budget.month });
          }
        }
      }
    }

    // Filter out existing months if not overwriting
    const monthsToCreate = validated.overwrite
      ? targetMonths
      : targetMonths.filter(
          tm => !existingBudgets.some(eb => eb.year === tm.year && eb.month === tm.month)
        );

    // Prepare budgets to insert/update
    // Check if new columns exist by checking if sourceBudget has source_type
    const hasNewColumns = 'source_type' in sourceBudget;
    
    const budgetsToUpsert = monthsToCreate.map(({ year, month }) => {
      const budget: any = {
        user_id: userId,
        category_id: sourceBudget.category_id,
        year,
        month,
        amount_planned: sourceBudget.amount_planned || 0,
        amount_actual: 0,
      };
      
      // Only add new fields if they exist in the database
      if (hasNewColumns) {
        budget.source_type = 'manual';
        budget.is_projected = false;
      }
      
      return budget;
    });

    let created = 0;
    let overwritten = 0;
    let skipped = 0;

    if (budgetsToUpsert.length > 0) {
      if (validated.overwrite) {
        // Use upsert to overwrite existing
        const { error: upsertError } = await supabase
          .from('budgets')
          .upsert(budgetsToUpsert, {
            onConflict: 'user_id,category_id,year,month',
          });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          // If error is about missing columns, try without new fields
          const errorMsg = upsertError.message?.toLowerCase() || '';
          if (errorMsg.includes('source_type') || errorMsg.includes('is_projected') || 
              errorMsg.includes('column') && errorMsg.includes('does not exist')) {
            const fallbackBudgets = budgetsToUpsert.map((budget: any) => {
              const { source_type, is_projected, ...rest } = budget;
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
        // When overwriting, all existing become overwritten, new ones become created
        overwritten = existingBudgets.length;
        created = Math.max(0, budgetsToUpsert.length - existingBudgets.length);
      } else {
        // Insert only new ones
        const { error: insertError } = await supabase
          .from('budgets')
          .insert(budgetsToUpsert);

        if (insertError) {
          console.error('Insert error:', insertError);
          // If error is about missing columns, try without new fields
          const errorMsg = insertError.message?.toLowerCase() || '';
          if (errorMsg.includes('source_type') || errorMsg.includes('is_projected') ||
              errorMsg.includes('column') && errorMsg.includes('does not exist')) {
            const fallbackBudgets = budgetsToUpsert.map((budget: any) => {
              const { source_type, is_projected, ...rest } = budget;
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
        created = budgetsToUpsert.length;
      }
    }

    // Skipped are the ones that exist and weren't overwritten
    skipped = validated.overwrite ? 0 : existingBudgets.length;

    // Invalidate cache for this user
    projectionCache.invalidateUser(userId);

    return NextResponse.json({
      data: {
        created,
        overwritten,
        skipped,
        total: targetMonths.length,
      },
    });
  } catch (error: any) {
    console.error('Budget replication error:', error);
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
      { error: errorResponse.error || 'Erro ao replicar orçamento', code: error?.code },
      { status: errorResponse.statusCode || 500 }
    );
  }
}

