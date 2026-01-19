/**
 * Admin WhatsApp Settings API
 *
 * GET: Get current WhatsApp/Evolution API settings
 * PUT: Update WhatsApp/Evolution API settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGlobalSettings, updateGlobalSettings, clearSettingsCache } from '@/services/admin/globalSettings';
import { clearEvolutionClientCache } from '@/services/evolution/client';

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return null;
  }

  return user.id;
}

export async function GET(request: NextRequest) {
  const adminId = await requireAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await getGlobalSettings(true); // Force refresh

    // Mask API keys for security
    return NextResponse.json({
      evolution_api_url: settings.evolution_api_url || '',
      evolution_api_key: settings.evolution_api_key ? '********' : '',
      evolution_api_key_set: !!settings.evolution_api_key,
      evolution_instance_name: settings.evolution_instance_name || '',
      evolution_webhook_secret: settings.evolution_webhook_secret ? '********' : '',
      evolution_webhook_secret_set: !!settings.evolution_webhook_secret,
      n8n_api_key: settings.n8n_api_key ? '********' : '',
      n8n_api_key_set: !!settings.n8n_api_key,
      whatsapp_enabled: settings.whatsapp_enabled || false,
    });
  } catch (error) {
    console.error('[Admin WhatsApp Settings] Error:', error);
    return NextResponse.json({ error: 'Erro ao carregar configuracoes' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const adminId = await requireAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const updates: Record<string, any> = {};

    // Only update fields that are provided (not masked)
    if (body.evolution_api_url !== undefined) {
      updates.evolution_api_url = body.evolution_api_url || null;
    }
    if (body.evolution_api_key !== undefined && body.evolution_api_key !== '********') {
      updates.evolution_api_key = body.evolution_api_key || null;
    }
    if (body.evolution_instance_name !== undefined) {
      updates.evolution_instance_name = body.evolution_instance_name || null;
    }
    if (body.evolution_webhook_secret !== undefined && body.evolution_webhook_secret !== '********') {
      updates.evolution_webhook_secret = body.evolution_webhook_secret || null;
    }
    if (body.n8n_api_key !== undefined && body.n8n_api_key !== '********') {
      updates.n8n_api_key = body.n8n_api_key || null;
    }
    if (body.whatsapp_enabled !== undefined) {
      updates.whatsapp_enabled = !!body.whatsapp_enabled;
    }

    await updateGlobalSettings(updates);

    // Clear caches
    clearSettingsCache();
    clearEvolutionClientCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin WhatsApp Settings] Error updating:', error);
    return NextResponse.json({ error: 'Erro ao salvar configuracoes' }, { status: 500 });
  }
}
