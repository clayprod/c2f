import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getAggregatedTransactions, type AggregationFilters } from '@/services/admin/aggregations';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const filters: AggregationFilters = {
      fromDate: searchParams.get('from_date') || undefined,
      toDate: searchParams.get('to_date') || undefined,
      period: searchParams.get('period') as any,
      search: searchParams.get('search') || undefined,
      minAge: searchParams.get('min_age') ? parseInt(searchParams.get('min_age')!) : undefined,
      maxAge: searchParams.get('max_age') ? parseInt(searchParams.get('max_age')!) : undefined,
      gender: searchParams.get('gender') || undefined,
      categoryId: searchParams.get('category_id') || undefined,
      groupBy: 'state',
    };

    const data = await getAggregatedTransactions(request, filters);
    
    // Format for map: states with coordinates and values
    const stateData = data
      .filter(d => d.group.length === 2) // Only state codes (2 chars)
      .map(d => ({
        state: d.group,
        total_expenses: d.total_expenses,
        total_income: d.total_income,
        transaction_count: d.transaction_count,
        user_count: d.user_count,
      }));

    return NextResponse.json({ data: stateData });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

