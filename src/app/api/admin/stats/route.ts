import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    // Require admin access
    await requireAdmin(request);

    // Use admin client to bypass RLS and see all data
    const supabase = createAdminClient();

    // Get total users
    const { count: totalUsers, error: usersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (usersError) throw usersError;

    // Get today's date to filter only actual (past/current) transactions
    const today = new Date().toISOString().split('T')[0];

    // Get total transactions (only past/current, not future installments)
    const { count: totalTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .lte('posted_at', today);

    if (transactionsError) throw transactionsError;

    // Get total income and expenses
    // Amounts in database are stored in reais (NUMERIC), need to convert to cents for frontend
    let totalIncome = 0;
    let totalExpenses = 0;

    // Fetch only actual transactions (past/current, not future installments)
    const { data: allTransactions, error: amountsError } = await supabase
      .from('transactions')
      .select('amount')
      .lte('posted_at', today)
      .limit(100000); // Limit to avoid memory issues

    if (amountsError) {
      console.error('Error fetching transactions for amounts:', amountsError);
      console.error('Error details:', amountsError.message);
      // Keep defaults (0) if query fails
    } else {
      allTransactions?.forEach((tx: any) => {
        // Amount is stored in reais (NUMERIC), convert to cents
        const amountReais = typeof tx.amount === 'string' ? parseFloat(tx.amount) : (tx.amount || 0);
        const amountCents = Math.round(amountReais * 100);
        
        // Positive amounts = income, negative amounts = expense
        if (amountCents > 0) {
          totalIncome += amountCents;
        } else if (amountCents < 0) {
          totalExpenses += Math.abs(amountCents);
        }
        // Ignore zero amounts
      });
      
      console.log(`Calculated totals: Income=${totalIncome} cents (R$ ${(totalIncome/100).toFixed(2)}), Expenses=${totalExpenses} cents (R$ ${(totalExpenses/100).toFixed(2)})`);
    }

    // Get plan distribution - only count active subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('billing_subscriptions')
      .select('plan_id, status, current_period_end')
      .eq('status', 'active');

    if (subsError) throw subsError;

    const planDistribution = {
      free: 0,
      pro: 0,
      premium: 0,
    };

    const now = new Date();
    let activePaidUsers = 0;

    subscriptions?.forEach((sub) => {
      // Only count subscriptions that are active and not expired
      const isExpired = sub.current_period_end 
        ? new Date(sub.current_period_end) < now 
        : false;
      
      if (!isExpired) {
        if (sub.plan_id === 'pro') {
          planDistribution.pro++;
          activePaidUsers++;
        } else if (sub.plan_id === 'business' || sub.plan_id === 'premium') {
          planDistribution.premium++;
          activePaidUsers++;
        }
      }
    });

    // Calculate free users (total - active paid users)
    planDistribution.free = Math.max(0, (totalUsers || 0) - activePaidUsers);

    // Get user growth over time (last 12 months)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('created_at')
      .order('created_at', { ascending: true });

    if (profilesError) throw profilesError;

    const nowForGrowth = new Date();
    const months: Record<string, number> = {};

    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(nowForGrowth.getFullYear(), nowForGrowth.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months[key] = 0;
    }

    // Count users created in each month (not cumulative)
    profiles?.forEach((profile) => {
      const date = new Date(profile.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (months.hasOwnProperty(key)) {
        months[key]++;
      }
    });

    // Convert to array format with cumulative count
    let cumulative = 0;
    const userGrowth = Object.entries(months).map(([month, count]) => {
      cumulative += count;
      return {
        month: `${month.substring(5, 7)}/${month.substring(0, 4)}`,
        count: cumulative,
      };
    });

    return NextResponse.json({
      total_users: totalUsers || 0,
      total_transactions: totalTransactions || 0,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      plan_distribution: planDistribution,
      user_growth: userGrowth,
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}


