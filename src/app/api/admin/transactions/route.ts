import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getAggregatedTransactions, type AggregationFilters } from '@/services/admin/aggregations';

export async function GET(request: NextRequest) {
  try {
    // Require admin access
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);

    const filters: AggregationFilters = {
      fromDate: searchParams.get('from_date') || undefined,
      toDate: searchParams.get('to_date') || undefined,
      period: searchParams.get('period') as 'month' | '3months' | 'semester' | 'year' | undefined,
      search: searchParams.get('search') || undefined,
      minAge: searchParams.get('min_age') ? parseInt(searchParams.get('min_age')!) : undefined,
      maxAge: searchParams.get('max_age') ? parseInt(searchParams.get('max_age')!) : undefined,
      gender: searchParams.get('gender') || undefined,
      categoryId: searchParams.get('category_id') || undefined,
      groupBy: (searchParams.get('group_by') as 'city' | 'state' | 'category' | 'month') || 'state',
    };

    const aggregatedData = await getAggregatedTransactions(request, filters);

    return NextResponse.json({
      data: aggregatedData,
      filters,
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}


