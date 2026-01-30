import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { categorySchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('source_type'); // Filter by source type
    const type = searchParams.get('type'); // Filter by income/expense
    const includeInactive = searchParams.get('include_inactive') === 'true'; // Include inactive categories

    const { supabase } = createClientFromRequest(request);
    let query = supabase
      .from('categories')
      .select('*')
      .eq('user_id', ownerId);

    if (sourceType) {
      query = query.eq('source_type', sourceType);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data: allData, error } = await query.order('name', { ascending: true });

    if (error) {
      // If error is about missing column, return all categories (backward compatibility)
      if (error.message?.includes('is_active') || error.message?.includes('column')) {
        console.warn('is_active column may not exist yet, returning all categories');
        return NextResponse.json({ data: allData || [] });
      }
      throw error;
    }

    // Filter by is_active in JavaScript for better compatibility
    // If includeInactive is false, only return active categories (including null/undefined for backward compatibility)
    let data = allData;
    if (!includeInactive && allData) {
      data = allData.filter(cat => {
        // Treat null, undefined, or true as active
        return cat.is_active !== false;
      });
    }

    return NextResponse.json({ data: data || [] });
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
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const body = await request.json();
    const validated = categorySchema.parse(body);

    const { supabase } = createClientFromRequest(request);
    const { data, error } = await supabase
      .from('categories')
      .insert({
        ...validated,
        user_id: ownerId,
        // If source_type is not provided, default to 'general'
        source_type: validated.source_type || 'general',
        // If is_active is not provided, default to true
        is_active: validated.is_active !== undefined ? validated.is_active : true,
        // expense_type is only applicable for expense categories
        expense_type: validated.type === 'expense' ? validated.expense_type : null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error },
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

