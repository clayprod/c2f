import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getUserId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/errors';
import { estimateTargetCount, validateSegment } from '@/services/notifications/adminSegmentation';
import { z } from 'zod';

const adminNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  link: z.string().url().optional().nullable(),
  scheduled_at: z.string().datetime().optional().nullable(),
  segment: z
    .object({
      gender: z.array(z.string()).optional().nullable(),
      states: z.array(z.string()).optional().nullable(),
      cities: z.array(z.string()).optional().nullable(),
      age_min: z.number().int().min(0).max(150).optional().nullable(),
      age_max: z.number().int().min(0).max(150).optional().nullable(),
      income_min_cents: z.number().int().min(0).optional().nullable(),
      income_max_cents: z.number().int().min(0).optional().nullable(),
      plan_ids: z.array(z.enum(['free', 'pro', 'premium'])).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('admin_notifications')
      .select('*, admin_notification_segments(*)')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

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

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = adminNotificationSchema.parse(body);

    // Validate segment if provided
    if (validated.segment) {
      const validation = validateSegment(validated.segment);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid segment', details: validation.errors },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    // Estimate target count
    const targetCount = validated.segment
      ? await estimateTargetCount(validated.segment)
      : null;

    // Determine status
    const scheduledAt = validated.scheduled_at
      ? new Date(validated.scheduled_at)
      : null;
    const status = scheduledAt && scheduledAt > new Date() ? 'scheduled' : 'draft';

    // Create notification
    const { data: notification, error: notificationError } = await supabase
      .from('admin_notifications')
      .insert({
        created_by: userId,
        title: validated.title,
        message: validated.message,
        type: validated.type,
        link: validated.link || null,
        status,
        scheduled_at: scheduledAt?.toISOString() || null,
        target_count: targetCount,
      })
      .select()
      .single();

    if (notificationError) throw notificationError;

    // Create segment if provided
    if (validated.segment) {
      const { error: segmentError } = await supabase
        .from('admin_notification_segments')
        .insert({
          notification_id: notification.id,
          gender: validated.segment.gender || null,
          states: validated.segment.states || null,
          cities: validated.segment.cities || null,
          age_min: validated.segment.age_min || null,
          age_max: validated.segment.age_max || null,
          income_min_cents: validated.segment.income_min_cents || null,
          income_max_cents: validated.segment.income_max_cents || null,
          plan_ids: validated.segment.plan_ids || null,
        });

      if (segmentError) throw segmentError;
    }

    // If status is draft and not scheduled, send immediately
    if (status === 'draft' && !scheduledAt) {
      // This will be handled by the send endpoint
    }

    return NextResponse.json({ data: notification });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
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
