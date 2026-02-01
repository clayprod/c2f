import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserId } from '@/lib/auth';
import { debtSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { generateAutoBudgetsForDebt } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const order = searchParams.get('order') || 'desc';

    const { supabase } = createClientFromRequest(request);
    let query = supabase
      .from('debts')
      .select('*, accounts(*), categories(*)')
      .eq('user_id', ownerId);

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    // Apply sorting
    const ascending = order === 'asc';
    if (sortBy === 'total_amount_cents') {
      query = query.order('total_amount_cents', { ascending });
    } else if (sortBy === 'remaining_amount_cents') {
      query = query.order('remaining_amount_cents', { ascending });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw error;

    // Fetch assigned_to profiles separately using admin client (bypasses RLS)
    const assignedToIds = [...new Set((data || [])
      .map((debt: any) => debt.assigned_to)
      .filter((id: string | null) => id !== null))] as string[];

    let profilesMap: Record<string, any> = {};
    if (assignedToIds.length > 0) {
      const admin = createAdminClient();
      const { data: profiles, error: profilesError } = await admin
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', assignedToIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      } else if (profiles) {
        profilesMap = profiles.reduce((acc: Record<string, any>, profile: any) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }
    }

    // Recalculate paid amounts from transactions for each debt
    if (data && data.length > 0) {
      for (const debt of data) {
        if (debt.category_id) {
          // Sum all transactions with this category (expenses = payments)
          const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', ownerId)
            .eq('category_id', debt.category_id)
            .lt('amount', 0); // Only expenses (payments)

          if (transactions) {
            const totalPaidCents = Math.abs(
              transactions.reduce((sum: number, tx: any) => sum + (tx.amount * 100), 0)
            );
            
            // Update debt if paid amount differs
            if (totalPaidCents !== (debt.paid_amount_cents || 0)) {
              await supabase
                .from('debts')
                .update({ 
                  paid_amount_cents: totalPaidCents
                })
                .eq('id', debt.id);
              
              debt.paid_amount_cents = totalPaidCents;
              debt.remaining_amount_cents = (debt.total_amount_cents || 0) - totalPaidCents;
            }
          }
        }
      }
    }

    // Merge assigned_to_profile data
    const transformedData = (data || []).map((debt: any) => {
      const assignedProfile = debt.assigned_to 
        ? (profilesMap[debt.assigned_to] || null)
        : null;

      return {
        ...debt,
        assigned_to_profile: assignedProfile,
      };
    });

    // Amounts are already in cents (BIGINT)
    return NextResponse.json({ data: transformedData });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const body = await request.json();
    const validated = debtSchema.parse(body);

    const { supabase } = createClientFromRequest(request);

    // Create a category for this debt (using debt name directly)
    const categoryName = validated.name.toUpperCase();
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .upsert({
        user_id: ownerId,
        name: categoryName,
        type: 'expense',
        icon: '💳',
        color: '#DC143C',
        source_type: 'debt',
      }, {
        onConflict: 'user_id,name,type',
      })
      .select()
      .single();

    if (categoryError) {
      console.error('Error creating debt category:', categoryError);
    }

    const hasCustomPlan = !!validated.plan_entries && validated.plan_entries.length > 0;
    const includeInPlan = hasCustomPlan ? true : validated.include_in_plan;

    // Validate custom plan total if using custom plan
    if (hasCustomPlan && validated.plan_entries && validated.plan_entries.length > 0) {
      const totalAmount = validated.total_amount_cents;
      const paidAmount = validated.paid_amount_cents || 0;
      const remainingAmount = totalAmount - paidAmount;
      const planTotal = validated.plan_entries.reduce((sum, entry) => sum + entry.amount_cents, 0);

      if (planTotal < remainingAmount) {
        // Log warning but don't prevent saving
        console.warn(`Debt ${validated.name}: Plan total (${planTotal}) is less than remaining amount (${remainingAmount})`);
      }
    }

    // Create the debt
    // Extract only the fields that exist in the database schema
    const debtData: any = {
      user_id: ownerId,
      name: validated.name,
      description: validated.description || null,
      creditor_name: validated.creditor_name || null,
      total_amount_cents: validated.total_amount_cents,
      paid_amount_cents: validated.paid_amount_cents || 0,
      interest_rate: validated.interest_rate_monthly || 0,
      due_date: validated.due_date || null,
      start_date: validated.start_date || null,
      status: validated.status || 'pendente',
      priority: validated.priority || 'medium',
      account_id: validated.account_id || null,
      category_id: category?.id || validated.category_id || null,
      notes: validated.notes || null,
      payment_frequency: validated.payment_frequency || null,
      payment_amount_cents: validated.payment_amount_cents || null,
      installment_count: validated.installment_count || null,
      include_in_plan: includeInPlan ?? true,
      assigned_to: validated.assigned_to || null,
    };

    // Add fields for plan inclusion
    if (validated.status === 'negociada') {
      debtData.is_negotiated = true;
      debtData.include_in_plan = includeInPlan ?? true;
      debtData.contribution_frequency = hasCustomPlan ? null : (validated.contribution_frequency || null);
      debtData.contribution_count = hasCustomPlan ? null : (validated.contribution_count || null);
      debtData.monthly_payment_cents = validated.monthly_payment_cents || null;
      debtData.installment_amount_cents = validated.installment_amount_cents || null;
      debtData.installment_day = validated.installment_day || null;
    } else {
      debtData.is_negotiated = false;
      debtData.include_in_plan = includeInPlan ?? false;
      // Allow contribution_frequency and monthly_payment_cents even if not negotiated
      if (includeInPlan && !hasCustomPlan) {
        debtData.contribution_frequency = validated.contribution_frequency || null;
        debtData.contribution_count = validated.contribution_count || null;
        debtData.monthly_payment_cents = validated.monthly_payment_cents || null;
      }
    }

    const insertDebtWithFallback = async () => {
      let payload: Record<string, any> = { ...debtData };
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error } = await supabase
          .from('debts')
          .insert(payload)
          .select('*, accounts(*), categories(*)')
          .single();

        if (!error) {
          return data;
        }

        const errorMessage = (error as { message?: string; code?: string })?.message || '';
        const errorCode = (error as { message?: string; code?: string })?.code || '';
        const missingColumnMatch = errorMessage.match(/'([^']+)'/);
        const missingColumn = missingColumnMatch?.[1];

        if (errorCode === 'PGRST204' && missingColumn && missingColumn in payload) {
          delete payload[missingColumn];
          continue;
        }

        throw error;
      }

      throw new Error('Failed to insert debt after removing unsupported fields');
    };

    const data = await insertDebtWithFallback();

    if (data && validated.plan_entries && validated.plan_entries.length > 0) {
      const planEntries = validated.plan_entries.map((entry) => ({
        user_id: ownerId,
        debt_id: data.id,
        category_id: data.category_id || null,
        entry_month: `${entry.month}-01`,
        amount_cents: entry.amount_cents,
        description: `Plano personalizado - ${data.name}`,
      }));

      const { error: planError } = await supabase
        .from('debt_plan_entries')
        .upsert(planEntries, {
          onConflict: 'debt_id,entry_month',
        });

      if (planError) {
        console.error('Error inserting debt plan entries:', planError);
      }
    }

    // Generate automatic budgets if include_in_plan is true and has contribution_frequency or is negotiated
    if (data.include_in_plan && data.category_id && (data.contribution_frequency || (data.is_negotiated && data.status === 'negociada'))) {
      try {
        const today = new Date();
        const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const endDate = new Date(today);
        
        // Calculate end month based on installment_count or default to 12 months
        if (data.installment_count) {
          endDate.setMonth(endDate.getMonth() + data.installment_count);
        } else {
          endDate.setMonth(endDate.getMonth() + 12);
        }
        const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

        await generateAutoBudgetsForDebt(
          supabase,
          ownerId,
          {
            id: data.id,
            category_id: data.category_id,
            include_in_plan: data.include_in_plan,
            is_negotiated: data.is_negotiated,
            status: data.status,
            contribution_frequency: data.contribution_frequency,
            contribution_count: data.contribution_count,
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
            overwrite: false,
          }
        );

        projectionCache.invalidateUser(ownerId);
      } catch (budgetError) {
        console.error('Error generating auto budgets for debt:', budgetError);
        // Don't fail the debt creation if budget generation fails
      }
    }

    // If adds_to_cash is true and we have a destination account, create an income transaction
    if (validated.adds_to_cash && validated.destination_account_id) {
      // Create an income category for loans if it doesn't exist
      let loanIncomeCategory;
      const { data: existingCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', ownerId)
        .eq('name', 'EMPRESTIMOS RECEBIDOS')
        .single();

      if (existingCategory) {
        loanIncomeCategory = existingCategory;
      } else {
        const { data: newCategory } = await supabase
          .from('categories')
          .insert({
            user_id: ownerId,
            name: 'EMPRESTIMOS RECEBIDOS',
            type: 'income',
            icon: '💰',
            color: '#32CD32',
          })
          .select()
          .single();
        loanIncomeCategory = newCategory;
      }

      // Create an income transaction for the total amount (principal)
      const principalAmount = validated.principal_amount_cents || validated.total_amount_cents;
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: ownerId,
          account_id: validated.destination_account_id,
          category_id: loanIncomeCategory?.id,
          posted_at: validated.start_date || new Date().toISOString().split('T')[0],
          description: `Empréstimo: ${validated.name}`,
          amount_cents: principalAmount, // Positive = income
          currency: 'BRL',
          source: 'manual',
          notes: `Valor recebido da dívida: ${validated.name}`,
        });

      if (txError) {
        console.error('Error creating loan income transaction:', txError);
      }

      // Update account balance
      const { data: account } = await supabase
        .from('accounts')
        .select('current_balance')
        .eq('id', validated.destination_account_id)
        .single();

      if (account) {
        // Convert cents to NUMERIC for calculation
        const currentBalance = parseFloat(account.current_balance || 0);
        const newBalance = currentBalance + (principalAmount / 100);
        await supabase
          .from('accounts')
          .update({
            current_balance: newBalance,
          })
          .eq('id', validated.destination_account_id);
      }
    }

    return NextResponse.json({
      data: {
        ...data,
        category_id: category?.id,
        category_name: category?.name,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating debt:', error);
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
