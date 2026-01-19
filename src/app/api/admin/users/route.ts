import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { listUsers } from '@/services/admin/userPlans';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Require admin access
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const plan = searchParams.get('plan') as 'free' | 'pro' | 'premium' | null;
    const status = searchParams.get('status') as 'active' | 'inactive' | null;
    const isManual = searchParams.get('is_manual');
    const search = searchParams.get('search') || undefined;
    
    const filters: any = {};
    if (plan) filters.plan = plan;
    if (status) filters.status = status;
    if (isManual !== null && isManual !== '') {
      filters.is_manual = isManual === 'true';
    }
    if (search) filters.search = search;

    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    console.log('listUsers called with filters:', filters, 'pagination:', { page, limit });
    
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing' },
        { status: 500 }
      );
    }
    
    const result = await listUsers(filters, { page, limit }, request);
    console.log('listUsers returned:', result.users.length, 'users');

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/admin/users:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Error name:', error?.name);
    
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { 
        error: errorResponse.error, 
        details: error?.message,
        hint: error?.hint || 'Check server logs for more details'
      },
      { status: errorResponse.statusCode }
    );
  }
}
