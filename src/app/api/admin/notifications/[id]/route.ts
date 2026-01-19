import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('admin_notifications')
      .select('*, admin_notification_segments(*), admin_notification_recipients(count)')
      .eq('id', id)
      .single();

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await params;
    const supabase = await createClient();

    // Only allow deletion of draft or cancelled notifications
    const { data: notification, error: fetchError } = await supabase
      .from('admin_notifications')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (notification.status === 'sent') {
      return NextResponse.json(
        { error: 'Cannot delete sent notifications' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('admin_notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
