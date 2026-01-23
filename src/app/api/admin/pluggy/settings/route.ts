import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getGlobalSettings, updateGlobalSettings } from '@/services/admin/globalSettings';

// Ensure no caching for this dynamic API route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const settings = await getGlobalSettings(true);

    console.log('[Pluggy Settings GET] Raw settings from DB:', {
      hasClientId: !!settings.pluggy_client_id,
      hasClientSecret: !!settings.pluggy_client_secret,
      pluggyEnabled: settings.pluggy_enabled,
      clientIdLength: settings.pluggy_client_id?.length,
      clientSecretLength: settings.pluggy_client_secret?.length,
    });

    const response = {
      pluggy_client_id: settings.pluggy_client_id ? '' : undefined,
      pluggy_client_id_set: !!settings.pluggy_client_id,
      pluggy_client_secret: settings.pluggy_client_secret ? '' : undefined,
      pluggy_client_secret_set: !!settings.pluggy_client_secret,
      pluggy_enabled: settings.pluggy_enabled || false,
      categorization_prompt: settings.categorization_prompt,
    };

    console.log('[Pluggy Settings GET] Response:', {
      pluggy_client_id_set: response.pluggy_client_id_set,
      pluggy_client_secret_set: response.pluggy_client_secret_set,
      pluggy_enabled: response.pluggy_enabled,
    });

    // Mask sensitive values but indicate if they're set
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching Pluggy settings:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar configurações' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();

    const updates: any = {};

    // Only update if value is provided (not empty string)
    if (body.pluggy_client_id) {
      updates.pluggy_client_id = body.pluggy_client_id;
    }
    if (body.pluggy_client_secret) {
      updates.pluggy_client_secret = body.pluggy_client_secret;
    }
    if (typeof body.pluggy_enabled === 'boolean') {
      updates.pluggy_enabled = body.pluggy_enabled;
    }
    if (body.categorization_prompt !== undefined) {
      updates.categorization_prompt = body.categorization_prompt;
    }

    console.log('[Pluggy Settings] Saving updates:', {
      hasClientId: !!updates.pluggy_client_id,
      hasClientSecret: !!updates.pluggy_client_secret,
      pluggyEnabled: updates.pluggy_enabled,
      hasCategorizationPrompt: !!updates.categorization_prompt,
    });

    await updateGlobalSettings(updates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating Pluggy settings:', error);
    
    // Check for specific Pluggy migration error
    if (error.code === 'PLUGGY_MIGRATION_REQUIRED') {
      return NextResponse.json(
        { 
          error: error.message,
          code: 'PLUGGY_MIGRATION_REQUIRED',
          action: 'Execute a migration 050_add_pluggy_settings.sql no Supabase Dashboard > SQL Editor'
        },
        { status: 400 }
      );
    }
    
    // Check if it's a column not found error
    const isColumnError = error.code === '42703' || error.message?.includes('column');
    const errorMessage = isColumnError 
      ? 'Colunas do Pluggy não encontradas. Execute a migration 050_add_pluggy_settings.sql'
      : error.message || 'Erro ao salvar configurações';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}
