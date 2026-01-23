import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getGlobalSettings } from '@/services/admin/globalSettings';

// Ensure no caching for this dynamic API route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const settings = await getGlobalSettings(true);

    if (!settings.pluggy_client_id || !settings.pluggy_client_secret) {
      return NextResponse.json(
        { error: 'Credenciais Pluggy nao configuradas' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.PLUGGY_BASE_URL || 'https://api.pluggy.ai';

    // Test authentication
    const authResponse = await fetch(`${baseUrl}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: settings.pluggy_client_id,
        clientSecret: settings.pluggy_client_secret,
      }),
    });

    if (!authResponse.ok) {
      const error = await authResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.message || 'Credenciais invalidas' },
        { status: 400 }
      );
    }

    const authData = await authResponse.json();

    if (!authData.apiKey) {
      return NextResponse.json(
        { error: 'Resposta invalida da API Pluggy' },
        { status: 400 }
      );
    }

    // Test listing connectors (to verify API access)
    const connectorsResponse = await fetch(`${baseUrl}/connectors?sandbox=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': authData.apiKey,
      },
    });

    if (!connectorsResponse.ok) {
      return NextResponse.json(
        { error: 'Autenticacao OK, mas erro ao listar conectores' },
        { status: 400 }
      );
    }

    const connectorsData = await connectorsResponse.json();

    return NextResponse.json({
      success: true,
      message: `Conexao testada com sucesso! ${connectorsData.results?.length || 0} conectores disponiveis.`,
      expiresIn: authData.expiresIn,
    });
  } catch (error: any) {
    console.error('Error testing Pluggy connection:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao testar conexao' },
      { status: 500 }
    );
  }
}
