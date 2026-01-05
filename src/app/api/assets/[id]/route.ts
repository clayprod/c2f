import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { assetSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();
    
    const { data: asset, error } = await supabase
      .from('assets')
      .select('*, accounts(*), categories(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Get all valuations for this asset
    const { data: valuations, error: valuationsError } = await supabase
      .from('asset_valuations')
      .select('*')
      .eq('asset_id', id)
      .eq('user_id', userId)
      .order('valuation_date', { ascending: true });

    if (valuationsError) {
      console.error('Error fetching valuations:', valuationsError);
    }

    // Get latest valuation
    const latestValuation = valuations && valuations.length > 0
      ? valuations[valuations.length - 1]
      : null;

    return NextResponse.json({
      data: {
        ...asset,
        current_value_cents: latestValuation?.value_cents || asset.current_value_cents || asset.purchase_price_cents,
        valuations: valuations || [],
      }
    });
  } catch (error) {
    console.error('Asset GET error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Create a partial asset schema for PATCH request
    const partialAssetSchema = z.object({
      name: z.string().min(1, 'Nome é obrigatório').optional(),
      type: z.enum(['real_estate', 'vehicle', 'rights', 'equipment', 'jewelry', 'other']).optional(),
      description: z.string().optional(),
      purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
      purchase_price_cents: z.preprocess(
        (val) => {
          if (val === null || val === undefined || val === '') {
            return val; // Let Zod handle the error
          }
          if (typeof val === 'number') {
            if (isNaN(val) || !isFinite(val)) return val;
            return Math.round(val * 100);
          }
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed === '') return val;
            const parsed = parseFloat(trimmed);
            if (isNaN(parsed) || !isFinite(parsed)) return val;
            return Math.round(parsed * 100);
          }
          return val;
        },
        z.number().int().positive('Valor de compra deve ser positivo')
      ).optional(),
      current_value_cents: z.preprocess(
        (val) => {
          // Handle empty values
          if (val === '' || val === null || val === undefined) {
            return undefined;
          }
          // Handle number values (already in reais, convert to cents)
          if (typeof val === 'number') {
            return Math.round(val * 100);
          }
          // Handle string values
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed === '') return undefined;
            const parsed = parseFloat(trimmed);
            return isNaN(parsed) ? undefined : Math.round(parsed * 100);
          }
          return undefined;
        },
        z.number().int().min(0).optional()
      ).optional(),
      location: z.string().optional(),
      license_plate: z.string().optional(),
      registration_number: z.string().optional(),
      insurance_company: z.string().optional(),
      insurance_policy_number: z.string().optional(),
      insurance_expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
      status: z.enum(['active', 'sold', 'disposed']).default('active').optional(),
      sale_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
      sale_price_cents: z.number().int().min(0).optional(),
      depreciation_method: z.enum(['linear', 'declining_balance', 'none']).default('none').optional(),
      depreciation_rate: z.number().min(0).max(100).optional(),
      useful_life_years: z.number().int().positive().optional(),
      account_id: z.string().uuid('ID da conta inválido').optional(),
      category_id: z.string().uuid('ID da categoria inválido').optional(),
      notes: z.string().optional(),
    });

    const validated = partialAssetSchema.parse(body);

    const supabase = await createClient();

    // Verify ownership
    const { data: existingAsset, error: checkError } = await supabase
      .from('assets')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (checkError || !existingAsset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.type !== undefined) updateData.type = validated.type;
    if (validated.description !== undefined) updateData.description = validated.description || null;
    if (validated.purchase_date !== undefined) updateData.purchase_date = validated.purchase_date;
    if (validated.purchase_price_cents !== undefined) updateData.purchase_price_cents = validated.purchase_price_cents;
    if (validated.current_value_cents !== undefined) updateData.current_value_cents = validated.current_value_cents;
    if (validated.location !== undefined) updateData.location = validated.location || null;
    if (validated.license_plate !== undefined) updateData.license_plate = validated.license_plate || null;
    if (validated.registration_number !== undefined) updateData.registration_number = validated.registration_number || null;
    if (validated.insurance_company !== undefined) updateData.insurance_company = validated.insurance_company || null;
    if (validated.insurance_policy_number !== undefined) updateData.insurance_policy_number = validated.insurance_policy_number || null;
    if (validated.insurance_expiry_date !== undefined) updateData.insurance_expiry_date = validated.insurance_expiry_date || null;
    if (validated.status !== undefined) updateData.status = validated.status;
    if (validated.sale_date !== undefined) updateData.sale_date = validated.sale_date || null;
    if (validated.sale_price_cents !== undefined) updateData.sale_price_cents = validated.sale_price_cents || null;
    if (validated.depreciation_method !== undefined) updateData.depreciation_method = validated.depreciation_method;
    if (validated.depreciation_rate !== undefined) updateData.depreciation_rate = validated.depreciation_rate || null;
    if (validated.useful_life_years !== undefined) updateData.useful_life_years = validated.useful_life_years || null;
    if (validated.account_id !== undefined) updateData.account_id = validated.account_id || null;
    if (validated.category_id !== undefined) updateData.category_id = validated.category_id || null;
    if (validated.notes !== undefined) updateData.notes = validated.notes || null;

    const { data: asset, error } = await supabase
      .from('assets')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, accounts(*), categories(*)')
      .single();

    if (error) throw error;

    return NextResponse.json({ data: asset });
  } catch (error: any) {
    console.error('Asset PATCH error:', error);
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // Verify ownership
    const { data: existingAsset, error: checkError } = await supabase
      .from('assets')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (checkError || !existingAsset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Delete asset (cascade will handle valuations)
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Asset DELETE error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

