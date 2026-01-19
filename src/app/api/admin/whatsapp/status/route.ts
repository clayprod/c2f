/**
 * Admin WhatsApp Status API
 *
 * GET: Get status of the Evolution API instance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEvolutionClient, getWhatsAppStatus } from '@/services/evolution/client';
import { getGlobalSettings } from '@/services/admin/globalSettings';

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
    const settings = await getGlobalSettings();

    // Check if configured
    if (!settings.evolution_api_url || !settings.evolution_api_key || !settings.evolution_instance_name) {
      return NextResponse.json({
        configured: false,
        connected: false,
        enabled: settings.whatsapp_enabled || false,
        message: 'Evolution API nao configurada',
      });
    }

    // Get client and check status
    const client = await getEvolutionClient();
    if (!client) {
      return NextResponse.json({
        configured: true,
        connected: false,
        enabled: settings.whatsapp_enabled || false,
        message: 'WhatsApp desabilitado ou erro na configuracao',
      });
    }

    try {
      const status = await getWhatsAppStatus();

      if (!status) {
        return NextResponse.json({
          configured: true,
          connected: false,
          enabled: settings.whatsapp_enabled || false,
          message: 'Nao foi possivel obter status da instancia',
        });
      }

      const isConnected = status.instance.state === 'open';

      // Get instance info for phone number
      let phoneNumber: string | undefined;
      try {
        const info = await client.getInstanceInfo();
        phoneNumber = info.number;
      } catch {
        // Ignore error getting info
      }

      return NextResponse.json({
        configured: true,
        connected: isConnected,
        enabled: settings.whatsapp_enabled || false,
        state: status.instance.state,
        instanceName: status.instance.instanceName,
        phoneNumber,
        message: isConnected ? 'Conectado' : 'Desconectado',
      });
    } catch (error: any) {
      console.error('[Admin WhatsApp Status] Error checking status:', error);
      return NextResponse.json({
        configured: true,
        connected: false,
        enabled: settings.whatsapp_enabled || false,
        message: `Erro ao conectar: ${error.message}`,
      });
    }
  } catch (error) {
    console.error('[Admin WhatsApp Status] Error:', error);
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 });
  }
}
