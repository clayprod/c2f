import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { assetValuationSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

interface RouteParams {
  params: Promise<{ id: string; valuationId: string }>;
}

// Helper to update asset's current_value_cents based on latest valuation
async function updateAssetCurrentValue(
  supabase: ReturnType<typeof createClientFromRequest>['supabase'],
  assetId: string,
  ownerId: string
) {
  // Get the latest valuation by date
  const { data: latestValuation } = await supabase
    .from('asset_valuations')
    .select('value_cents')
    .eq('asset_id', assetId)
    .eq('user_id', ownerId)
    .order('valuation_date', { ascending: false })
    .limit(1)
    .single();

  // Get the asset's purchase price as fallback
  const { data: asset } = await supabase
    .from('assets')
    .select('purchase_price_cents')
    .eq('id', assetId)
    .eq('user_id', ownerId)
    .single();

  // Update asset current value to latest valuation or purchase price
  const newCurrentValue = latestValuation?.value_cents ?? asset?.purchase_price_cents ?? 0;
  
  await supabase
    .from('assets')
    .update({ current_value_cents: newCurrentValue })
    .eq('id', assetId)
    .eq('user_id', ownerId);
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { id, valuationId } = await params;
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

    // Get the specific valuation
    const { data: valuation, error } = await supabase
      .from('asset_valuations')
      .select('*')
      .eq('id', valuationId)
      .eq('asset_id', id)
      .eq('user_id', ownerId)
      .single();

    if (error || !valuation) {
      return NextResponse.json({ error: 'Valuation not found' }, { status: 404 });
    }

    return NextResponse.json({ data: valuation });
  } catch (error) {
    console.error('Asset valuation GET error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { id, valuationId } = await params;
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

    // Verify valuation exists and belongs to this asset
    const { data: existingValuation, error: valError } = await supabase
      .from('asset_valuations')
      .select('id')
      .eq('id', valuationId)
      .eq('asset_id', id)
      .eq('user_id', ownerId)
      .single();

    if (valError || !existingValuation) {
      return NextResponse.json({ error: 'Valuation not found' }, { status: 404 });
    }

    // Update the valuation
    const { data: valuation, error } = await supabase
      .from('asset_valuations')
      .update({
        valuation_date: validated.valuation_date,
        value_cents: validated.value_cents,
        valuation_type: validated.valuation_type,
        notes: validated.notes || null,
      })
      .eq('id', valuationId)
      .eq('user_id', ownerId)
      .select()
      .single();

    if (error) throw error;

    // Update asset's current_value_cents based on latest valuation
    await updateAssetCurrentValue(supabase, id, ownerId);

    return NextResponse.json({ data: valuation });
  } catch (error: any) {
    console.error('Asset valuation PUT error:', error);
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

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { id, valuationId } = await params;
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

    // Verify valuation exists
    const { data: existingValuation, error: valError } = await supabase
      .from('asset_valuations')
      .select('id')
      .eq('id', valuationId)
      .eq('asset_id', id)
      .eq('user_id', ownerId)
      .single();

    if (valError || !existingValuation) {
      return NextResponse.json({ error: 'Valuation not found' }, { status: 404 });
    }

    // Delete the valuation
    const { error } = await supabase
      .from('asset_valuations')
      .delete()
      .eq('id', valuationId)
      .eq('user_id', ownerId);

    if (error) throw error;

    // Update asset's current_value_cents based on remaining valuations
    await updateAssetCurrentValue(supabase, id, ownerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Asset valuation DELETE error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
