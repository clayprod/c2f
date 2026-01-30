import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data, error } = (await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single()) as { data: any; error: { message: string } | null };

    if (error || !data) {
      return NextResponse.json({ error: 'Importação não encontrada' }, { status: 404 });
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
