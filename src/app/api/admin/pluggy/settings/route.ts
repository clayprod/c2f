import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getGlobalSettings, updateGlobalSettings } from '@/services/admin/globalSettings';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const settings = await getGlobalSettings(true);

    // Mask sensitive values but indicate if they're set
    return NextResponse.json({
      pluggy_client_id: settings.pluggy_client_id ? '' : undefined,
      pluggy_client_id_set: !!settings.pluggy_client_id,
      pluggy_client_secret: settings.pluggy_client_secret ? '' : undefined,
      pluggy_client_secret_set: !!settings.pluggy_client_secret,
      pluggy_enabled: settings.pluggy_enabled || false,
      categorization_prompt: settings.categorization_prompt,
    });
  } catch (error: any) {
    console.error('Error fetching Pluggy settings:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar configuracoes' },
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
    
    // Check if it's a column not found error
    const isColumnError = error.code === '42703' || error.message?.includes('column');
    const errorMessage = isColumnError 
      ? 'Colunas do Pluggy nao encontradas. Execute a migration 050_add_pluggy_settings.sql'
      : error.message || 'Erro ao salvar configuracoes';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}
