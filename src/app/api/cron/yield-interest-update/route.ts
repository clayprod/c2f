import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateOverdraftInterestBudget } from '@/services/budgets/overdraftInterest';
import { generateAccountYieldBudget } from '@/services/budgets/accountYield';

export const dynamic = 'force-dynamic';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    
    // Get current date for processing
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

    // Get all active users
    const { data: activeUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1000);

    if (usersError) {
      console.error('[Yield/Interest Cron] Error fetching users:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    if (!activeUsers || activeUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active users found',
        processed: 0,
      });
    }

    const results = {
      processed: 0,
      interest_budgets_created: 0,
      yield_budgets_created: 0,
      errors: 0,
    };

    // Process users in batches
    const batchSize = 10;
    for (let i = 0; i < activeUsers.length; i += batchSize) {
      const batch = activeUsers.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (user) => {
          try {
            // Generate overdraft interest budget for current month
            const interestResult = await generateOverdraftInterestBudget(
              supabase,
              user.id,
              currentYear,
              currentMonth
            );

            // Generate account yield budget for current month
            const yieldResult = await generateAccountYieldBudget(
              supabase,
              user.id,
              currentYear,
              currentMonth
            );

            results.processed++;
            if (interestResult.created) {
              results.interest_budgets_created++;
            }
            if (yieldResult.created) {
              results.yield_budgets_created++;
            }

            console.log(`[Yield/Interest Cron] User ${user.id}:`, {
              interest_created: interestResult.created,
              yield_created: yieldResult.created,
            });
          } catch (error) {
            console.error(`[Yield/Interest Cron] Error processing user ${user.id}:`, error);
            results.errors++;
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < activeUsers.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Daily yield and interest update completed',
      ...results,
    });
  } catch (error) {
    console.error('[Yield/Interest Cron] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}