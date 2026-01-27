import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSegmentedUsers } from '@/services/notifications/adminSegmentation';
import { createNotification } from '@/services/notifications/helper';

export const dynamic = 'force-dynamic';

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

    const supabase = createAdminClient();

    // Get scheduled notifications that are ready to send
    const now = new Date().toISOString();
    const { data: notifications, error: fetchError } = await supabase
      .from('admin_notifications')
      .select('*, admin_notification_segments(*)')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now);

    if (fetchError) {
      console.error('Error fetching scheduled notifications:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      );
    }

    if (!notifications || notifications.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scheduled notifications to send',
        processed: 0,
      });
    }

    const results = {
      processed: 0,
      total_notifications: 0,
      errors: 0,
    };

    // Process each notification
    for (const notification of notifications) {
      try {
        // Get target users
        let userIds: string[];

        if (notification.admin_notification_segments) {
          userIds = await getSegmentedUsers(notification.admin_notification_segments, { supabase });
        } else {
          // Get all users
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id');
          userIds = (profiles || []).map((p) => p.id);
        }

        // Create notifications for each user
        const batchSize = 50;
        let created = 0;

        for (let i = 0; i < userIds.length; i += batchSize) {
          const batch = userIds.slice(i, i + batchSize);

          await Promise.all(
            batch.map(async (userId) => {
              try {
                const notificationId = await createNotification(userId, {
                  title: notification.title,
                  message: notification.message,
                  type: notification.type as any,
                  link: notification.link,
                  metadata: {
                    admin_notification_id: notification.id,
                    source: 'admin',
                  },
                }, { supabase });

                if (notificationId) {
                  // Record recipient
                  await supabase.from('admin_notification_recipients').insert({
                    notification_id: notification.id,
                    user_id: userId,
                  });
                  created++;
                }
              } catch (error) {
                console.error(
                  `Error creating notification for user ${userId}:`,
                  error
                );
              }
            })
          );
        }

        // Update notification status
        await supabase
          .from('admin_notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            target_count: created,
          })
          .eq('id', notification.id);

        results.processed++;
        results.total_notifications += created;
      } catch (error) {
        console.error(
          `Error processing notification ${notification.id}:`,
          error
        );
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Scheduled notifications processed',
      ...results,
    });
  } catch (error) {
    console.error('Error in cron admin notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
