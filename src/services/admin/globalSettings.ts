/**
 * Global Settings Service
 * Manages global system settings with fallback to environment variables
 */

import { createClient } from '@/lib/supabase/server';

export interface GlobalSettings {
  // SMTP
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_password?: string | null;
  smtp_from_email?: string | null;
  // API Keys
  groq_api_key?: string | null;
  openai_api_key?: string | null;
  // AI Model
  ai_model?: 'groq' | 'openai' | null;
  ai_model_name?: string | null;
  // Prompts
  advisor_prompt?: string | null;
  insights_prompt?: string | null;
  tips_prompt?: string | null;
  // Advisor Settings
  tips_enabled?: boolean | null;
  chat_max_tokens?: number | null;
  session_ttl_minutes?: number | null;
  // Stripe
  stripe_price_id_pro?: string | null;
  stripe_price_id_business?: string | null;
}

let cachedSettings: GlobalSettings | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get global settings from database with fallback to env vars
 */
export async function getGlobalSettings(): Promise<GlobalSettings> {
  // Check cache
  const now = Date.now();
  if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('global_settings')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching global settings:', error);
    }

    const settings: GlobalSettings = {};

    if (data) {
      // Use database values if available
      settings.smtp_host = data.smtp_host;
      settings.smtp_port = data.smtp_port;
      settings.smtp_user = data.smtp_user;
      settings.smtp_password = data.smtp_password;
      settings.smtp_from_email = data.smtp_from_email;
      settings.groq_api_key = data.groq_api_key;
      settings.openai_api_key = data.openai_api_key;
      settings.ai_model = data.ai_model as 'groq' | 'openai' | null;
      settings.ai_model_name = data.ai_model_name;
      settings.advisor_prompt = data.advisor_prompt;
      settings.insights_prompt = data.insights_prompt;
      settings.tips_prompt = data.tips_prompt;
      settings.tips_enabled = data.tips_enabled;
      settings.chat_max_tokens = data.chat_max_tokens;
      settings.session_ttl_minutes = data.session_ttl_minutes;
      settings.stripe_price_id_pro = data.stripe_price_id_pro;
      settings.stripe_price_id_business = data.stripe_price_id_business;
    }

    // Fallback to environment variables if not in database
    if (!settings.groq_api_key) {
      settings.groq_api_key = process.env.GROQ_API_KEY || null;
    }
    if (!settings.openai_api_key) {
      settings.openai_api_key = process.env.OPENAI_API_KEY || null;
    }
    if (!settings.ai_model) {
      settings.ai_model = (process.env.AI_MODEL as 'groq' | 'openai') || 'groq';
    }
    if (!settings.ai_model_name) {
      settings.ai_model_name = process.env.AI_MODEL_NAME || 'llama-3.3-70b-versatile';
    }
    if (!settings.stripe_price_id_pro) {
      settings.stripe_price_id_pro = process.env.STRIPE_PRICE_ID_PRO || null;
    }
    if (!settings.stripe_price_id_business) {
      settings.stripe_price_id_business = process.env.STRIPE_PRICE_ID_BUSINESS || null;
    }

    // Cache the result
    cachedSettings = settings;
    cacheTimestamp = now;

    return settings;
  } catch (error) {
    console.error('Error in getGlobalSettings:', error);
    // Return fallback values
    return {
      groq_api_key: process.env.GROQ_API_KEY || null,
      openai_api_key: process.env.OPENAI_API_KEY || null,
      ai_model: (process.env.AI_MODEL as 'groq' | 'openai') || 'groq',
      ai_model_name: process.env.AI_MODEL_NAME || 'llama-3.3-70b-versatile',
      stripe_price_id_pro: process.env.STRIPE_PRICE_ID_PRO || null,
      stripe_price_id_business: process.env.STRIPE_PRICE_ID_BUSINESS || null,
    };
  }
}

/**
 * Update global settings (admin only)
 */
export async function updateGlobalSettings(updates: Partial<GlobalSettings>): Promise<void> {
  const supabase = await createClient();

  // Get existing settings or create new
  const { data: existing } = await supabase
    .from('global_settings')
    .select('id')
    .limit(1)
    .single();

  const updateData: any = {};

  // Only update provided fields
  if (updates.smtp_host !== undefined) updateData.smtp_host = updates.smtp_host;
  if (updates.smtp_port !== undefined) updateData.smtp_port = updates.smtp_port;
  if (updates.smtp_user !== undefined) updateData.smtp_user = updates.smtp_user;
  if (updates.smtp_password !== undefined) updateData.smtp_password = updates.smtp_password;
  if (updates.smtp_from_email !== undefined) updateData.smtp_from_email = updates.smtp_from_email;
  if (updates.groq_api_key !== undefined) updateData.groq_api_key = updates.groq_api_key;
  if (updates.openai_api_key !== undefined) updateData.openai_api_key = updates.openai_api_key;
  if (updates.ai_model !== undefined) updateData.ai_model = updates.ai_model;
  if (updates.ai_model_name !== undefined) updateData.ai_model_name = updates.ai_model_name;
  if (updates.advisor_prompt !== undefined) updateData.advisor_prompt = updates.advisor_prompt;
  if (updates.insights_prompt !== undefined) updateData.insights_prompt = updates.insights_prompt;
  if (updates.tips_prompt !== undefined) updateData.tips_prompt = updates.tips_prompt;
  if (updates.tips_enabled !== undefined) updateData.tips_enabled = updates.tips_enabled;
  if (updates.chat_max_tokens !== undefined) updateData.chat_max_tokens = updates.chat_max_tokens;
  if (updates.session_ttl_minutes !== undefined) updateData.session_ttl_minutes = updates.session_ttl_minutes;
  if (updates.stripe_price_id_pro !== undefined) updateData.stripe_price_id_pro = updates.stripe_price_id_pro;
  if (updates.stripe_price_id_business !== undefined) updateData.stripe_price_id_business = updates.stripe_price_id_business;

  try {
    if (existing) {
      const { error } = await supabase
        .from('global_settings')
        .update(updateData)
        .eq('id', existing.id);

      if (error) {
        // If columns don't exist, try without the new fields
        if (error.code === '42703' || error.message?.includes('column')) {
          const basicData = { ...updateData };
          delete basicData.tips_prompt;
          delete basicData.tips_enabled;
          delete basicData.chat_max_tokens;
          delete basicData.session_ttl_minutes;

          const { error: retryError } = await supabase
            .from('global_settings')
            .update(basicData)
            .eq('id', existing.id);

          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }
    } else {
      const { error } = await supabase
        .from('global_settings')
        .insert(updateData);

      if (error) {
        // If columns don't exist, try without the new fields
        if (error.code === '42703' || error.message?.includes('column')) {
          const basicData = { ...updateData };
          delete basicData.tips_prompt;
          delete basicData.tips_enabled;
          delete basicData.chat_max_tokens;
          delete basicData.session_ttl_minutes;

          const { error: retryError } = await supabase
            .from('global_settings')
            .insert(basicData);

          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }
    }
  } finally {
    // Invalidate cache
    cachedSettings = null;
    cacheTimestamp = 0;
  }
}

/**
 * Clear settings cache (useful after updates)
 */
export function clearSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}

