import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { investmentSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { generateAutoBudgetsForInvestment } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const { supabase } = createClientFromRequest(request);
    let query = supabase
      .from('investments')
      .select('*, accounts(*), categories(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Recalculate current values from transactions for each investment
    if (data && data.length > 0) {
      for (const investment of data) {
        if (investment.category_id) {
          // Sum all transactions with this category
          const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .eq('category_id', investment.category_id);

          if (transactions && transactions.length > 0) {
            // Expenses (negative) = contributions (increase value)
            // Income (positive) = withdrawals (decrease value)
            const contributions = transactions
              .filter((tx: any) => tx.amount < 0)
              .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount * 100), 0);
            
            const withdrawals = transactions
              .filter((tx: any) => tx.amount > 0)
              .reduce((sum: number, tx: any) => sum + (tx.amount * 100), 0);

            const calculatedValue = (investment.initial_investment_cents || 0) + contributions - withdrawals;
            
            // Update investment if current value differs
            if (calculatedValue !== (investment.current_value_cents || investment.initial_investment_cents || 0)) {
              await supabase
                .from('investments')
                .update({ current_value_cents: calculatedValue })
                .eq('id', investment.id);
              
              investment.current_value_cents = calculatedValue;
            }
          }
        }
      }
    }

    return NextResponse.json({ data });
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

    const body = await request.json();
    const validated = investmentSchema.parse(body);

    const { supabase } = createClientFromRequest(request);

    // Create a category for this investment (using investment name directly)
    const categoryName = validated.name.toUpperCase();
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        name: categoryName,
        type: 'expense', // Contributions are expenses, but can also be used for income (dividends/withdrawals)
        icon: '📊',
        color: '#00CED1',
        source_type: 'investment',
      })
      .select()
      .single();

    if (categoryError) {
      console.error('Error creating investment category:', categoryError);
    }

    const { data, error } = await supabase
      .from('investments')
      .insert({
        ...validated,
        user_id: userId,
        initial_investment_cents: validated.initial_investment_cents,
        current_value_cents: validated.current_value_cents || validated.initial_investment_cents,
        category_id: category?.id,
      })
      .select('*, accounts(*), categories(*)')
      .single();

    if (error) throw error;

    // Generate automatic budgets if include_in_budget is true
    if (data.include_in_budget && data.status === 'active' && data.category_id && 
        data.contribution_frequency && data.monthly_contribution_cents) {
      try {
        const today = new Date();
        const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + 12); // Next 12 months
        const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

        await generateAutoBudgetsForInvestment(
          supabase,
          userId,
          {
            id: data.id,
            category_id: data.category_id,
            include_in_budget: data.include_in_budget,
            status: data.status,
            contribution_frequency: data.contribution_frequency,
            monthly_contribution_cents: data.monthly_contribution_cents,
            purchase_date: data.purchase_date,
          },
          {
            startMonth,
            endMonth,
            overwrite: false,
          }
        );

        projectionCache.invalidateUser(userId);
      } catch (budgetError) {
        console.error('Error generating auto budgets for investment:', budgetError);
        // Don't fail the investment creation if budget generation fails
      }
    }

    // Create purchase transaction if requested
    const createPurchaseTransaction = (body as any).create_purchase_transaction === true;
    if (createPurchaseTransaction && data.category_id) {
      try {
        // Get default account if account_id not provided
        let accountId = validated.account_id;
        if (!accountId) {
          const { data: defaultAccount } = await supabase
            .from('accounts')
            .select('id')
            .eq('user_id', userId)
            .eq('type', 'checking')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();
          accountId = defaultAccount?.id;
        }

        if (accountId) {
          const { error: txError } = await supabase
            .from('transactions')
            .insert({
              user_id: userId,
              account_id: accountId,
              category_id: data.category_id,
              posted_at: validated.purchase_date,
              description: `Compra: ${validated.name}`,
              amount: -validated.initial_investment_cents / 100, // Negative for expense
              currency: 'BRL',
              source: 'manual',
            });

          if (txError) {
            console.error('Error creating purchase transaction:', txError);
            // Don't fail the whole operation if transaction creation fails
          }
        }
      } catch (txError: any) {
        console.error('Error creating purchase transaction:', txError);
        // Don't fail the whole operation if transaction creation fails
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



