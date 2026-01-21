import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserId } from '@/lib/auth';
import { assetSchema } from '@/lib/validation/schemas';
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
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    const { supabase } = createClientFromRequest(request);
    let query = supabase
      .from('assets')
      .select('*, accounts(*), categories(*)')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: assets, error } = await query;

    if (error) throw error;

    // Fetch assigned_to profiles separately using admin client (bypasses RLS)
    const assignedToIds = [...new Set((assets || [])
      .map((asset: any) => asset.assigned_to)
      .filter((id: string | null) => id !== null))] as string[];

    let profilesMap: Record<string, any> = {};
    if (assignedToIds.length > 0) {
      const admin = createAdminClient();
      const { data: profiles, error: profilesError } = await admin
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', assignedToIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      } else if (profiles) {
        profilesMap = profiles.reduce((acc: Record<string, any>, profile: any) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }
    }

    // Get latest valuation for each asset
    if (assets && assets.length > 0) {
      const assetIds = assets.map(a => a.id);
      const { data: latestValuations } = await supabase
        .from('asset_valuations')
        .select('asset_id, value_cents, valuation_date')
        .in('asset_id', assetIds)
        .order('valuation_date', { ascending: false });

      // Group by asset_id and get the latest
      const valuationsMap = new Map<string, any>();
      if (latestValuations) {
        latestValuations.forEach((v: any) => {
          if (!valuationsMap.has(v.asset_id)) {
            valuationsMap.set(v.asset_id, v);
          }
        });
      }

      // Add latest valuation and assigned_to_profile to each asset
      const processedAssets = assets.map((asset: any) => {
        const latestValuation = valuationsMap.get(asset.id);
        const assignedProfile = asset.assigned_to 
          ? (profilesMap[asset.assigned_to] || null)
          : null;
        return {
          ...asset,
          current_value_cents: latestValuation?.value_cents || asset.current_value_cents || asset.purchase_price_cents,
          last_valuation_date: latestValuation?.valuation_date || null,
          assigned_to_profile: assignedProfile,
        };
      });

      return NextResponse.json({ data: processedAssets });
    }

    // Merge assigned_to_profile data even if no valuations
    const transformedAssets = (assets || []).map((asset: any) => {
      const assignedProfile = asset.assigned_to 
        ? (profilesMap[asset.assigned_to] || null)
        : null;
      return {
        ...asset,
        assigned_to_profile: assignedProfile,
      };
    });

    return NextResponse.json({ data: transformedAssets });
  } catch (error) {
    console.error('Assets GET error:', error);
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
    const validated = assetSchema.parse(body);

    const { supabase } = createClientFromRequest(request);

    // Create a category for this asset (using asset name directly)
    const categoryName = validated.name.toUpperCase();
    let categoryId = validated.category_id;

    if (!categoryId) {
      // Try to create category
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .insert({
          user_id: ownerId,
          name: categoryName,
          type: 'expense', // Default, but can be 'income' depending on asset
          icon: '🏠',
          color: '#00CED1',
          source_type: 'asset',
        })
        .select()
        .single();

      if (categoryError) {
        // If duplicate error, find existing category
        if (categoryError.code === '23505') { // Unique violation
          const { data: existingCategory } = await supabase
            .from('categories')
            .select('id')
            .eq('user_id', ownerId)
            .eq('name', categoryName)
            .eq('source_type', 'asset')
            .single();
          categoryId = existingCategory?.id;
        } else {
          console.error('Error creating asset category:', categoryError);
        }
      } else {
        categoryId = category?.id;
      }
    }

    // Set current_value_cents to purchase_price_cents if not provided
    const currentValueCents = validated.current_value_cents || validated.purchase_price_cents;

    // Create the asset
    const { data: asset, error } = await supabase
      .from('assets')
      .insert({
        user_id: ownerId,
        name: validated.name,
        type: validated.type,
        description: validated.description || null,
        purchase_date: validated.purchase_date,
        purchase_price_cents: validated.purchase_price_cents,
        current_value_cents: currentValueCents,
        location: validated.location || null,
        license_plate: validated.license_plate || null,
        registration_number: validated.registration_number || null,
        insurance_company: validated.insurance_company || null,
        insurance_policy_number: validated.insurance_policy_number || null,
        insurance_expiry_date: validated.insurance_expiry_date || null,
        status: validated.status,
        sale_date: validated.sale_date || null,
        sale_price_cents: validated.sale_price_cents || null,
        depreciation_method: validated.depreciation_method,
        depreciation_rate: validated.depreciation_rate || null,
        useful_life_years: validated.useful_life_years || null,
        account_id: validated.account_id || null,
        category_id: categoryId || validated.category_id || null,
        notes: validated.notes || null,
        assigned_to: validated.assigned_to || null,
      })
      .select('*, accounts(*), categories(*)')
      .single();

    if (error) {
      console.error('Error creating asset:', error);
      throw error;
    }

    // Create initial valuation record with purchase price
    const { error: valuationError } = await supabase
      .from('asset_valuations')
      .insert({
        asset_id: asset.id,
        user_id: ownerId,
        valuation_date: validated.purchase_date,
        value_cents: validated.purchase_price_cents,
        valuation_type: 'manual',
        notes: 'Valor de compra',
      });

    if (valuationError) {
      console.error('Error creating initial valuation:', valuationError);
      // Don't fail the whole operation if valuation creation fails
    }

    // Create purchase transaction if requested
    const createPurchaseTransaction = (body as any).create_purchase_transaction === true;
    if (createPurchaseTransaction && asset.category_id) {
      try {
        // Get default account if account_id not provided
        let accountId = validated.account_id;
        if (!accountId) {
          const { data: defaultAccount } = await supabase
            .from('accounts')
            .select('id')
            .eq('user_id', ownerId)
            .eq('type', 'checking')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();
          accountId = defaultAccount?.id;
        }

        if (accountId) {
          const { error: txError } = await supabase
            .from('transactions')
            .insert({
              user_id: ownerId,
              account_id: accountId,
              category_id: asset.category_id,
              posted_at: validated.purchase_date,
              description: `Compra: ${validated.name}`,
              amount: -validated.purchase_price_cents / 100, // Negative for expense
              currency: 'BRL',
              source: 'manual',
            });

          if (txError) {
            console.error('Error creating purchase transaction:', txError);
            // Don't fail the whole operation if transaction creation fails
          }
        }
      } catch (txError: any) {
        console.error('Error creating purchase transaction:', txError);
        // Don't fail the whole operation if transaction creation fails
      }
    }

    return NextResponse.json({
      data: asset
    }, { status: 201 });
  } catch (error: any) {
    console.error('Asset creation error:', error);
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

