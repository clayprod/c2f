import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/errors';
import { getSegmentedUsers } from '@/services/notifications/adminSegmentation';
import { createNotification } from '@/services/notifications/helper';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await params;
    const supabase = await createClient();

    // Get notification
    const { data: notification, error: fetchError } = await supabase
      .from('admin_notifications')
      .select('*, admin_notification_segments(*)')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (notification.status === 'sent') {
      return NextResponse.json(
        { error: 'Notification already sent' },
        { status: 400 }
      );
    }

    // Get target users
    let userIds: string[];

    if (notification.admin_notification_segments) {
      // Get segmented users
      userIds = await getSegmentedUsers(notification.admin_notification_segments);
    } else {
      // Get all users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id');

      if (profilesError) throw profilesError;
      userIds = (profiles || []).map((p) => p.id);
    }

    // Create notifications for each user
    const batchSize = 50;
    let created = 0;
    let errors = 0;

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
            });

            if (notificationId) {
              // Record recipient
              await supabase.from('admin_notification_recipients').insert({
                notification_id: notification.id,
                user_id: userId,
              });
              created++;
            }
          } catch (error) {
            console.error(`Error creating notification for user ${userId}:`, error);
            errors++;
          }
        })
      );
    }

    // Update notification status
    const { error: updateError } = await supabase
      .from('admin_notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        target_count: created,
      })
      .eq('id', id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      notifications_created: created,
      errors,
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
