/**
 * WhatsApp Verification Service
 *
 * Handles phone number verification for WhatsApp integration.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/services/evolution/client';

export interface VerificationStatus {
  userId: string;
  phoneNumber: string | null;
  phoneNumberNormalized: string | null;
  status: 'pending' | 'verified' | 'expired' | 'revoked' | null;
  verifiedAt: string | null;
}

export interface UserByPhone {
  userId: string;
  email: string;
  fullName: string | null;
  verified: boolean;
}

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Normalize phone number (remove + and non-digits)
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Format phone number for display (+55 11 99999-9999)
 */
export function formatPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length === 13) {
    // Brazilian number: 5511999999999
    return `+${normalized.slice(0, 2)} ${normalized.slice(2, 4)} ${normalized.slice(4, 9)}-${normalized.slice(9)}`;
  }
  if (normalized.length === 12) {
    // Brazilian number without 9: 551199999999
    return `+${normalized.slice(0, 2)} ${normalized.slice(2, 4)} ${normalized.slice(4, 8)}-${normalized.slice(8)}`;
  }
  return `+${normalized}`;
}

/**
 * Send verification code to a phone number
 */
export async function sendVerificationCode(
  userId: string,
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  // Check if phone is already verified by another user
  const { data: existingVerification } = await supabase
    .from('whatsapp_verifications')
    .select('user_id, status')
    .eq('phone_number_normalized', normalizedPhone)
    .neq('user_id', userId)
    .single();

  if (existingVerification && existingVerification.status === 'verified') {
    return {
      success: false,
      error: 'Este número já está vinculado a outra conta',
    };
  }

  // Generate verification code
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Upsert verification record
  const { error: upsertError } = await supabase
    .from('whatsapp_verifications')
    .upsert(
      {
        user_id: userId,
        phone_number: phoneNumber.startsWith('+') ? phoneNumber : `+${normalizedPhone}`,
        phone_number_normalized: normalizedPhone,
        verification_code: code,
        verification_code_expires_at: expiresAt.toISOString(),
        status: 'pending',
        verified_at: null,
      },
      {
        onConflict: 'user_id',
      }
    );

  if (upsertError) {
    console.error('[WhatsApp Verification] Error upserting verification:', upsertError);
    return {
      success: false,
      error: 'Erro ao salvar código de verificação',
    };
  }

  // Send code via WhatsApp
  try {
    await sendWhatsAppMessage(
      normalizedPhone,
      `Seu código de verificação do c2Finance é: *${code}*\n\nEste código expira em 10 minutos.\n\nSe você não solicitou este código, ignore esta mensagem.`
    );

    return { success: true };
  } catch (error) {
    console.error('[WhatsApp Verification] Error sending message:', error);

    // Rollback the verification record
    await supabase
      .from('whatsapp_verifications')
      .delete()
      .eq('user_id', userId);

    return {
      success: false,
      error: 'Erro ao enviar código de verificação. Verifique se o número está correto.',
    };
  }
}

/**
 * Validate verification code
 */
export async function validateVerificationCode(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get verification record
  const { data: verification, error: fetchError } = await supabase
    .from('whatsapp_verifications')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .single();

  if (fetchError || !verification) {
    return {
      success: false,
      error: 'Nenhuma verificação pendente encontrada',
    };
  }

  // Check if code is expired
  if (new Date(verification.verification_code_expires_at) < new Date()) {
    await supabase
      .from('whatsapp_verifications')
      .update({ status: 'expired' })
      .eq('id', verification.id);

    return {
      success: false,
      error: 'Código expirado. Solicite um novo código.',
    };
  }

  // Check if code matches
  if (verification.verification_code !== code) {
    return {
      success: false,
      error: 'Código incorreto',
    };
  }

  // Mark as verified
  const { error: updateError } = await supabase
    .from('whatsapp_verifications')
    .update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      verification_code: null, // Clear the code after successful verification
      verification_code_expires_at: null,
    })
    .eq('id', verification.id);

  if (updateError) {
    console.error('[WhatsApp Verification] Error updating verification:', updateError);
    return {
      success: false,
      error: 'Erro ao confirmar verificação',
    };
  }

  // Send confirmation message
  try {
    await sendWhatsAppMessage(
      verification.phone_number_normalized,
      `Seu número foi verificado com sucesso! Agora você pode gerenciar suas transações enviando mensagens para este número.\n\nExemplos:\n- "Gastei 50 reais no mercado"\n- "Recebi 1000 de salário"\n- "Quanto tenho na conta?"`
    );
  } catch (error) {
    // Don't fail verification if confirmation message fails
    console.error('[WhatsApp Verification] Error sending confirmation:', error);
  }

  return { success: true };
}

/**
 * Get user by phone number
 */
export async function getUserByPhoneNumber(phone: string): Promise<UserByPhone | null> {
  // Use admin client to bypass RLS (this is called from n8n API routes)
  const supabase = createAdminClient();
  const normalizedPhone = normalizePhoneNumber(phone);

  const { data, error } = await supabase
    .from('whatsapp_verifications')
    .select(`
      user_id,
      status,
      profiles!inner(email, full_name)
    `)
    .eq('phone_number_normalized', normalizedPhone)
    .eq('status', 'verified')
    .single();

  if (error || !data) {
    return null;
  }

  const profile = data.profiles as any;
  return {
    userId: data.user_id,
    email: profile.email,
    fullName: profile.full_name,
    verified: data.status === 'verified',
  };
}

/**
 * Get verification status for a user
 */
export async function getVerificationStatus(userId: string): Promise<VerificationStatus> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('whatsapp_verifications')
    .select('phone_number, phone_number_normalized, status, verified_at')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return {
      userId,
      phoneNumber: null,
      phoneNumberNormalized: null,
      status: null,
      verifiedAt: null,
    };
  }

  return {
    userId,
    phoneNumber: data.phone_number,
    phoneNumberNormalized: data.phone_number_normalized,
    status: data.status,
    verifiedAt: data.verified_at,
  };
}

/**
 * Check if user has a verified WhatsApp number
 */
export async function hasVerifiedWhatsApp(userId: string): Promise<boolean> {
  const status = await getVerificationStatus(userId);
  return status.status === 'verified';
}

/**
 * Disconnect (revoke) WhatsApp verification
 */
export async function disconnectWhatsApp(userId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('whatsapp_verifications')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('[WhatsApp Verification] Error disconnecting:', error);
    return {
      success: false,
      error: 'Erro ao desconectar WhatsApp',
    };
  }

  return { success: true };
}
