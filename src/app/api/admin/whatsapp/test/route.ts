/**
 * Admin WhatsApp Test API
 *
 * POST: Send a test message via Evolution API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/services/evolution/client';
import { normalizePhoneNumber } from '@/services/whatsapp/verification';

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

export async function POST(request: NextRequest) {
  const adminId = await requireAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { phone_number, message } = body;

    if (!phone_number) {
      return NextResponse.json({ error: 'Numero de telefone obrigatorio' }, { status: 400 });
    }

    const normalizedPhone = normalizePhoneNumber(phone_number);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      return NextResponse.json({ error: 'Numero de telefone invalido' }, { status: 400 });
    }

    const testMessage = message || `Teste de integracao WhatsApp - c2Finance\n\nSe voce recebeu esta mensagem, a integracao esta funcionando corretamente.`;

    const result = await sendWhatsAppMessage(normalizedPhone, testMessage);

    return NextResponse.json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      messageId: result?.key?.id,
    });
  } catch (error: any) {
    console.error('[Admin WhatsApp Test] Error:', error);
    return NextResponse.json({
      error: error.message || 'Erro ao enviar mensagem de teste',
    }, { status: 500 });
  }
}
