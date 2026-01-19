/**
 * WhatsApp Disconnect API (User)
 *
 * DELETE: Disconnect WhatsApp number from account
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { disconnectWhatsApp } from '@/services/whatsapp/verification';

async function getUserId(request: NextRequest): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await disconnectWhatsApp(userId);

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Erro ao desconectar WhatsApp',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'WhatsApp desconectado com sucesso',
    });
  } catch (error: any) {
    console.error('[WhatsApp Disconnect] Error:', error);
    return NextResponse.json({
      error: error.message || 'Erro ao desconectar',
    }, { status: 500 });
  }
}
