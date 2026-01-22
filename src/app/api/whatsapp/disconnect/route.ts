/**
 * WhatsApp Disconnect API (User)
 *
 * DELETE: Disconnect WhatsApp number from account
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { disconnectWhatsApp } from '@/services/whatsapp/verification';

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerId = await getEffectiveOwnerId(request, userId);

    const result = await disconnectWhatsApp(ownerId);

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
