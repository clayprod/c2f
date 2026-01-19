import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/errors';
import { estimateTargetCount } from '@/services/notifications/adminSegmentation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await params;
    const supabase = await createClient();

    // Get notification segment
    const { data: segment, error: fetchError } = await supabase
      .from('admin_notification_segments')
      .select('*')
      .eq('notification_id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw fetchError;
    }

    let targetCount: number;

    if (segment) {
      targetCount = await estimateTargetCount(segment);
    } else {
      // No segment = all users
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      targetCount = count || 0;
    }

    return NextResponse.json({
      target_count: targetCount,
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
