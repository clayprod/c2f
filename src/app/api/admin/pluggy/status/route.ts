import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getGlobalSettings } from '@/services/admin/globalSettings';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const settings = await getGlobalSettings(true);

    const configured = !!(settings.pluggy_client_id && settings.pluggy_client_secret);
    const enabled = settings.pluggy_enabled || false;

    // If not configured, return early
    if (!configured) {
      return NextResponse.json({
        configured: false,
        connected: false,
        enabled: false,
        message: 'Credenciais Pluggy nao configuradas',
      });
    }

    // Test connection by trying to get an access token
    try {
      const baseUrl = process.env.PLUGGY_BASE_URL || 'https://api.pluggy.ai';
      const response = await fetch(`${baseUrl}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: settings.pluggy_client_id,
          clientSecret: settings.pluggy_client_secret,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return NextResponse.json({
          configured: true,
          connected: false,
          enabled,
          message: error.message || 'Erro ao conectar com Pluggy API',
        });
      }

      const data = await response.json();

      return NextResponse.json({
        configured: true,
        connected: !!data.apiKey,
        enabled,
        message: 'Conexao com Pluggy API funcionando',
      });
    } catch (error: any) {
      return NextResponse.json({
        configured: true,
        connected: false,
        enabled,
        message: error.message || 'Erro de conexao com Pluggy API',
      });
    }
  } catch (error: any) {
    console.error('Error fetching Pluggy status:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao verificar status' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}
