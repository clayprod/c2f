import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkAllNotifications } from '@/services/notifications/rules';

// Verify cron secret if provided
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    // If no secret is configured, allow (for development)
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get all active users (users who have logged in recently or have data)
    // We'll get users who have profiles and have created transactions, budgets, or other data
    const { data: activeUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1000); // Limit to avoid timeout, can be adjusted

    if (usersError) {
      console.error('Error fetching active users:', usersError);
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
      total_notifications: 0,
      errors: 0,
    };

    // Process users in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < activeUsers.length; i += batchSize) {
      const batch = activeUsers.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (user) => {
          try {
            const result = await checkAllNotifications(user.id);
            results.processed++;
            results.total_notifications += result.total;
          } catch (error) {
            console.error(`Error processing notifications for user ${user.id}:`, error);
            results.errors++;
          }
        })
      );

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < activeUsers.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Notification checks completed',
      ...results,
    });
  } catch (error) {
    console.error('Error in cron notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
