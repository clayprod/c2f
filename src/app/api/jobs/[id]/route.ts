import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);
    const { supabase } = createClientFromRequest(request);

    const { data, error } = (await (supabase as any)
      .from('jobs')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .single()) as { data: any; error: { message: string } | null };

    if (error || !data) {
      return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ job: data });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
