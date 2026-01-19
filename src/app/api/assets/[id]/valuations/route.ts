import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { assetValuationSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { id } = await params;
    const { supabase } = createClientFromRequest(request);

    // Verify asset ownership
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('id')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Get all valuations
    const { data: valuations, error } = await supabase
      .from('asset_valuations')
      .select('*')
      .eq('asset_id', id)
      .eq('user_id', ownerId)
      .order('valuation_date', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: valuations || [] });
  } catch (error) {
    console.error('Asset valuations GET error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { id } = await params;
    const body = await request.json();
    
    // Override asset_id from params
    const bodyWithAssetId = { ...body, asset_id: id };
    const validated = assetValuationSchema.parse(bodyWithAssetId);

    const { supabase } = createClientFromRequest(request);

    // Verify asset ownership
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('id')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Create valuation
    const { data: valuation, error } = await supabase
      .from('asset_valuations')
      .insert({
        asset_id: id,
        user_id: ownerId,
        valuation_date: validated.valuation_date,
        value_cents: validated.value_cents,
        valuation_type: validated.valuation_type,
        notes: validated.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Update asset's current_value_cents
    await supabase
      .from('assets')
      .update({ current_value_cents: validated.value_cents })
      .eq('id', id)
      .eq('user_id', ownerId);

    return NextResponse.json({
      data: valuation
    }, { status: 201 });
  } catch (error: any) {
    console.error('Asset valuation POST error:', error);
    if (error && error.name === 'ZodError') {
      const zodError = error as any;
      const errorMessages = zodError.errors?.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      })) || [];
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: errorMessages,
        },
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

