import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { debtSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { generateAutoBudgetsForDebt } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { supabase } = createClientFromRequest(request);
    const { data, error } = await supabase
      .from('debts')
      .select('*, accounts(*), categories(*), debt_payments(*)')
      .eq('id', id)
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Create a partial debt schema for PATCH request
    const partialDebtSchema = z.object({
      name: z.string().min(1, 'Nome é obrigatório').optional(),
      description: z.string().optional(),
      creditor_name: z.string().optional(),
      principal_amount_cents: z.number().int().positive('Valor principal deve ser positivo').optional(),
      total_amount_cents: z.number().int().positive('Valor total deve ser positivo').optional(),
      paid_amount_cents: z.number().int().min(0).default(0).optional(),
      interest_rate_monthly: z.number().min(0).max(100).default(0).optional(),
      interest_type: z.enum(['simple', 'compound']).default('simple').optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
      status: z.enum(['active', 'paid', 'overdue', 'paga', 'negociando', 'negociada']).default('active').optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').optional(),
      account_id: z.string().uuid('ID da conta inválido').optional(),
      category_id: z.string().uuid('ID da categoria inválido').optional(),
      notes: z.string().optional(),
      adds_to_cash: z.boolean().default(false).optional(),
      destination_account_id: z.string().uuid('ID da conta de destino inválido').optional(),
      installment_amount_cents: z.number().int().positive().optional(),
      installment_count: z.number().int().positive().optional(),
      current_installment: z.number().int().positive().default(1).optional(),
      installment_day: z.number().int().min(1).max(31).optional(),
      payment_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
      payment_amount_cents: z.number().int().positive('Valor de pagamento deve ser positivo').optional(),
      include_in_budget: z.boolean().default(false).optional(),
      contribution_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
      is_negotiated: z.boolean().optional(), // Added this field which might be needed for updates
    });

    const validated = partialDebtSchema.parse(body);

    const { supabase } = createClientFromRequest(request);
    
    // Get current debt to check changes
    const { data: currentDebt } = await supabase
      .from('debts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!currentDebt) {
      return NextResponse.json(
        { error: 'Debt not found' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('debts')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, accounts(*), categories(*)')
      .single();

    if (error) throw error;

    // Regenerate budgets if is_negotiated and include_in_budget changed or was enabled
    const isNegotiatedChanged = validated.is_negotiated !== undefined && validated.is_negotiated !== currentDebt.is_negotiated;
    const includeInBudgetChanged = validated.include_in_budget !== undefined && validated.include_in_budget !== currentDebt.include_in_budget;
    const statusChanged = validated.status !== undefined && validated.status !== currentDebt.status;

    if (data && data.is_negotiated && data.include_in_budget && data.category_id &&
        (isNegotiatedChanged || includeInBudgetChanged || statusChanged ||
         (data.status === 'active' || data.status === 'negotiating' || data.status === 'negociando'))) {
      try {
        const today = new Date();
        const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const endDate = new Date(today);
        
        if (data.installment_count) {
          endDate.setMonth(endDate.getMonth() + data.installment_count);
        } else {
          endDate.setMonth(endDate.getMonth() + 12);
        }
        const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

        await generateAutoBudgetsForDebt(
          supabase,
          userId,
          {
            id: data.id,
            category_id: data.category_id,
            include_in_budget: data.include_in_budget,
            is_negotiated: data.is_negotiated,
            status: data.status,
            contribution_frequency: data.contribution_frequency,
            monthly_payment_cents: data.monthly_payment_cents,
            installment_count: data.installment_count,
            installment_amount_cents: data.installment_amount_cents,
            installment_day: data.installment_day,
            total_amount_cents: data.total_amount_cents,
            paid_amount_cents: data.paid_amount_cents || 0,
            start_date: data.start_date,
          },
          {
            startMonth,
            endMonth,
            overwrite: true, // Overwrite when debt is updated
          }
        );

        projectionCache.invalidateUser(userId);
      } catch (budgetError) {
        console.error('Error regenerating auto budgets for debt:', budgetError);
        // Don't fail the debt update if budget generation fails
      }
    } else if (data && (!data.is_negotiated || !data.include_in_budget || 
               !['active', 'negotiating', 'negociando'].includes(data.status))) {
      // Remove auto-generated budgets if conditions no longer met
      try {
        await supabase
          .from('budgets')
          .delete()
          .eq('user_id', userId)
          .eq('category_id', data.category_id)
          .eq('source_type', 'debt')
          .eq('source_id', data.id)
          .eq('is_auto_generated', true);
        
        projectionCache.invalidateUser(userId);
      } catch (deleteError) {
        console.error('Error deleting auto budgets for debt:', deleteError);
      }
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { supabase } = createClientFromRequest(request);
    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', id)
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



