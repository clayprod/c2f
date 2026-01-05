import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    // Require admin access
    await requireAdmin(request);

    const { supabase } = createClientFromRequest(request);

    // Get total users
    const { count: totalUsers, error: usersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (usersError) throw usersError;

    // Get total transactions
    const { count: totalTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    if (transactionsError) throw transactionsError;

    // Get total income and expenses
    const { data: transactions, error: amountsError } = await supabase
      .from('transactions')
      .select('amount');

    if (amountsError) throw amountsError;

    let totalIncome = 0;
    let totalExpenses = 0;

    transactions?.forEach((tx) => {
      const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
      if (amount > 0) {
        totalIncome += amount;
      } else {
        totalExpenses += Math.abs(amount);
      }
    });

    // Get plan distribution
    const { data: subscriptions, error: subsError } = await supabase
      .from('billing_subscriptions')
      .select('plan_id, status');

    if (subsError) throw subsError;

    const planDistribution = {
      free: 0,
      pro: 0,
      business: 0,
    };

    subscriptions?.forEach((sub) => {
      if (sub.plan_id === 'free') planDistribution.free++;
      else if (sub.plan_id === 'pro') planDistribution.pro++;
      else if (sub.plan_id === 'business') planDistribution.business++;
    });

    // Calculate free users (total - paid)
    const paidUsers = (planDistribution.pro + planDistribution.business);
    planDistribution.free = (totalUsers || 0) - paidUsers;

    // Get user growth over time (last 12 months)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('created_at')
      .order('created_at', { ascending: true });

    if (profilesError) throw profilesError;

    const now = new Date();
    const months: Record<string, number> = {};

    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months[key] = 0;
    }

    // Count users per month
    let cumulative = 0;
    profiles?.forEach((profile) => {
      const date = new Date(profile.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (months.hasOwnProperty(key)) {
        cumulative++;
        months[key] = cumulative;
      } else if (date < new Date(now.getFullYear(), now.getMonth() - 11, 1)) {
        // Before the 12-month window, still count cumulative
        cumulative++;
      }
    });

    // Convert to array format
    const userGrowth = Object.entries(months).map(([month, count]) => ({
      month,
      count,
    }));

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

