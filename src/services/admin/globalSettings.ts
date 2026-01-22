/**
 * Global Settings Service
 * Manages global system settings with fallback to environment variables
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface PlanFeature {
  enabled: boolean;
  text: string;
}

export type PlanFeatures = Record<string, PlanFeature>;

export interface PlanDisplayConfig {
  free?: {
    name?: string;
    description?: string;
    priceFormatted?: string;
    period?: string;
    cta?: string;
    popular?: boolean;
  };
  pro?: {
    name?: string;
    description?: string;
    period?: string;
    cta?: string;
    popular?: boolean;
  };
  premium?: {
    name?: string;
    description?: string;
    period?: string;
    cta?: string;
    popular?: boolean;
  };
}

export interface GlobalSettings {
  // SMTP
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_password?: string | null;
  smtp_from_email?: string | null;
  smtp_secure?: boolean | null;
  // API Keys
  groq_api_key?: string | null;
  openai_api_key?: string | null;
  // AI Model
  ai_model?: 'groq' | 'openai' | null;
  ai_model_name?: string | null;
  // Prompts
  advisor_prompt?: string | null;
  tips_prompt?: string | null;
  categorization_prompt?: string | null;
  // Advisor Settings
  tips_enabled?: boolean | null;
  chat_max_tokens?: number | null;
  session_ttl_minutes?: number | null;
  // Stripe
  stripe_price_id_pro?: string | null;
  stripe_price_id_business?: string | null;
  // AI Limits
  advisor_limit_pro?: number | null;
  advisor_limit_premium?: number | null;
  // Support Contacts
  support_email?: string | null;
  support_whatsapp?: string | null;
  // Evolution API (WhatsApp Integration)
  evolution_api_url?: string | null;
  evolution_api_key?: string | null;
  evolution_instance_name?: string | null;
  evolution_webhook_secret?: string | null;
  n8n_api_key?: string | null;
  whatsapp_enabled?: boolean | null;
  // Pluggy (Open Finance Integration)
  pluggy_client_id?: string | null;
  pluggy_client_secret?: string | null;
  pluggy_enabled?: boolean | null;
  // Plan Features
  plan_features_free?: PlanFeatures | null;
  plan_features_pro?: PlanFeatures | null;
  plan_features_premium?: PlanFeatures | null;
  plan_display_config?: PlanDisplayConfig | null;
}

let cachedSettings: GlobalSettings | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get global settings from database with fallback to env vars
 */
export async function getGlobalSettings(forceRefresh = false): Promise<GlobalSettings> {
  // Check cache (unless force refresh)
  const now = Date.now();
  if (!forceRefresh && cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    // Use admin client to bypass RLS (this is a server-side service)
    const supabase = createAdminClient();

    // Define columns - some may not exist in older databases
    const allColumns = 'support_email, support_whatsapp, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email, smtp_secure, groq_api_key, openai_api_key, ai_model, ai_model_name, advisor_prompt, tips_prompt, categorization_prompt, tips_enabled, chat_max_tokens, session_ttl_minutes, stripe_price_id_pro, stripe_price_id_business, advisor_limit_pro, advisor_limit_premium, evolution_api_url, evolution_api_key, evolution_instance_name, evolution_webhook_secret, n8n_api_key, whatsapp_enabled, pluggy_client_id, pluggy_client_secret, pluggy_enabled, plan_features_free, plan_features_pro, plan_features_premium, plan_display_config';
    // Minimal columns that should exist in all database versions
    const minimalColumns = 'support_email, support_whatsapp, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email, groq_api_key, openai_api_key, ai_model, ai_model_name, advisor_prompt, stripe_price_id_pro, stripe_price_id_business, evolution_api_url, evolution_api_key, evolution_instance_name, evolution_webhook_secret, n8n_api_key, whatsapp_enabled';

    let { data, error } = await supabase
      .from('global_settings')
      .select(allColumns)
      .limit(1)
      .single();

    // If column doesn't exist (42703), retry with minimal columns
    if (error && error.code === '42703') {
      console.log('[GlobalSettings] Some columns missing, retrying with minimal columns');
      const retryResult = await supabase
        .from('global_settings')
        .select(minimalColumns)
        .limit(1)
        .single();
      data = retryResult.data as typeof data;
      error = retryResult.error;
    }

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[GlobalSettings] Error fetching global settings:', error);
    }

    const settings: GlobalSettings = {};

    if (data) {
      // Use database values if available
      settings.smtp_host = data.smtp_host;
      settings.smtp_port = data.smtp_port;
      settings.smtp_user = data.smtp_user;
      settings.smtp_password = data.smtp_password;
      settings.smtp_from_email = data.smtp_from_email;
      settings.smtp_secure = data.smtp_secure;
      settings.groq_api_key = data.groq_api_key;
      settings.openai_api_key = data.openai_api_key;
      settings.ai_model = data.ai_model as 'groq' | 'openai' | null;
      settings.ai_model_name = data.ai_model_name;
      settings.advisor_prompt = data.advisor_prompt;
      settings.tips_prompt = data.tips_prompt;
      settings.tips_enabled = data.tips_enabled;
      settings.chat_max_tokens = data.chat_max_tokens;
      settings.session_ttl_minutes = data.session_ttl_minutes;
      settings.stripe_price_id_pro = data.stripe_price_id_pro;
      settings.stripe_price_id_business = data.stripe_price_id_business;
      settings.advisor_limit_pro = data.advisor_limit_pro;
      settings.advisor_limit_premium = data.advisor_limit_premium;
      settings.support_email = data.support_email;
      settings.support_whatsapp = data.support_whatsapp;
      // Evolution API / WhatsApp Integration
      settings.evolution_api_url = data.evolution_api_url;
      settings.evolution_api_key = data.evolution_api_key;
      settings.evolution_instance_name = data.evolution_instance_name;
      settings.evolution_webhook_secret = data.evolution_webhook_secret;
      settings.n8n_api_key = data.n8n_api_key;
      settings.whatsapp_enabled = data.whatsapp_enabled;
      // Pluggy / Open Finance Integration
      settings.pluggy_client_id = data.pluggy_client_id;
      settings.pluggy_client_secret = data.pluggy_client_secret;
      settings.pluggy_enabled = data.pluggy_enabled;
      settings.categorization_prompt = data.categorization_prompt;
      // Plan Features
      settings.plan_features_free = data.plan_features_free as PlanFeatures | null;
      settings.plan_features_pro = data.plan_features_pro as PlanFeatures | null;
      settings.plan_features_premium = data.plan_features_premium as PlanFeatures | null;
      settings.plan_display_config = data.plan_display_config as PlanDisplayConfig | null;

      console.log('[GlobalSettings] Fetched settings:', {
        hasSupportEmail: !!data.support_email,
        hasSupportWhatsapp: !!data.support_whatsapp,
        supportEmail: data.support_email,
        supportWhatsapp: data.support_whatsapp,
      });
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
      advisor_limit_pro: 10,
      advisor_limit_premium: 100,
    };
  }
}

/**
 * Update global settings (admin only)
 */
export async function updateGlobalSettings(updates: Partial<GlobalSettings>): Promise<void> {
  // Use admin client to bypass RLS (authorization is done at the API route level)
  const supabase = createAdminClient();

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
  if (updates.smtp_secure !== undefined) updateData.smtp_secure = updates.smtp_secure;
  if (updates.groq_api_key !== undefined) updateData.groq_api_key = updates.groq_api_key;
  if (updates.openai_api_key !== undefined) updateData.openai_api_key = updates.openai_api_key;
  if (updates.ai_model !== undefined) updateData.ai_model = updates.ai_model;
  if (updates.ai_model_name !== undefined) updateData.ai_model_name = updates.ai_model_name;
  if (updates.advisor_prompt !== undefined) updateData.advisor_prompt = updates.advisor_prompt;
  if (updates.tips_prompt !== undefined) updateData.tips_prompt = updates.tips_prompt;
  if (updates.tips_enabled !== undefined) updateData.tips_enabled = updates.tips_enabled;
  if (updates.chat_max_tokens !== undefined) updateData.chat_max_tokens = updates.chat_max_tokens;
  if (updates.session_ttl_minutes !== undefined) updateData.session_ttl_minutes = updates.session_ttl_minutes;
  if (updates.stripe_price_id_pro !== undefined) updateData.stripe_price_id_pro = updates.stripe_price_id_pro;
  if (updates.stripe_price_id_business !== undefined) updateData.stripe_price_id_business = updates.stripe_price_id_business;
  if (updates.advisor_limit_pro !== undefined) updateData.advisor_limit_pro = updates.advisor_limit_pro;
  if (updates.advisor_limit_premium !== undefined) updateData.advisor_limit_premium = updates.advisor_limit_premium;
  if (updates.support_email !== undefined) updateData.support_email = updates.support_email;
  if (updates.support_whatsapp !== undefined) updateData.support_whatsapp = updates.support_whatsapp;
  // Evolution API / WhatsApp Integration
  if (updates.evolution_api_url !== undefined) updateData.evolution_api_url = updates.evolution_api_url;
  if (updates.evolution_api_key !== undefined) updateData.evolution_api_key = updates.evolution_api_key;
  if (updates.evolution_instance_name !== undefined) updateData.evolution_instance_name = updates.evolution_instance_name;
  if (updates.evolution_webhook_secret !== undefined) updateData.evolution_webhook_secret = updates.evolution_webhook_secret;
  if (updates.n8n_api_key !== undefined) updateData.n8n_api_key = updates.n8n_api_key;
  if (updates.whatsapp_enabled !== undefined) updateData.whatsapp_enabled = updates.whatsapp_enabled;
  // Pluggy / Open Finance Integration
  if (updates.pluggy_client_id !== undefined) updateData.pluggy_client_id = updates.pluggy_client_id;
  if (updates.pluggy_client_secret !== undefined) updateData.pluggy_client_secret = updates.pluggy_client_secret;
  if (updates.pluggy_enabled !== undefined) updateData.pluggy_enabled = updates.pluggy_enabled;
  if (updates.categorization_prompt !== undefined) updateData.categorization_prompt = updates.categorization_prompt;
  // Plan Features
  if (updates.plan_features_free !== undefined) updateData.plan_features_free = updates.plan_features_free;
  if (updates.plan_features_pro !== undefined) updateData.plan_features_pro = updates.plan_features_pro;
  if (updates.plan_features_premium !== undefined) updateData.plan_features_premium = updates.plan_features_premium;
  if (updates.plan_display_config !== undefined) updateData.plan_display_config = updates.plan_display_config;

  try {
    console.log('updateGlobalSettings - updateData keys:', Object.keys(updateData));
    console.log('updateGlobalSettings - smtp_secure value:', updateData.smtp_secure);
    
    if (existing) {
      const { error } = await supabase
        .from('global_settings')
        .update(updateData)
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating global_settings:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // If columns don't exist, try without the new fields
        if (error.code === '42703' || error.message?.includes('column')) {
          console.log('Column error detected, retrying without new fields. Error:', error.message);
          const basicData = { ...updateData };
          // Remove fields that may not exist in older database schemas
          delete basicData.tips_prompt;
          delete basicData.tips_enabled;
          delete basicData.chat_max_tokens;
          delete basicData.session_ttl_minutes;
          delete basicData.smtp_secure;
          delete basicData.categorization_prompt;
          // Pluggy fields (added in migration 050)
          delete basicData.pluggy_client_id;
          delete basicData.pluggy_client_secret;
          delete basicData.pluggy_enabled;

          const { error: retryError } = await supabase
            .from('global_settings')
            .update(basicData)
            .eq('id', existing.id);

          if (retryError) {
            console.error('Retry error:', retryError);
            throw retryError;
          }
          console.log('Successfully updated without new fields. Note: Pluggy settings require migration 050_add_pluggy_settings.sql');
        } else {
          throw error;
        }
      } else {
        console.log('Successfully updated global_settings');
      }
    } else {
      const { error } = await supabase
        .from('global_settings')
        .insert(updateData);

      if (error) {
        // If columns don't exist, try without the new fields
        if (error.code === '42703' || error.message?.includes('column')) {
          console.log('Column error on insert, retrying without new fields. Error:', error.message);
          const basicData = { ...updateData };
          delete basicData.tips_prompt;
          delete basicData.tips_enabled;
          delete basicData.chat_max_tokens;
          delete basicData.session_ttl_minutes;
          delete basicData.smtp_secure;
          delete basicData.categorization_prompt;
          // Pluggy fields (added in migration 050)
          delete basicData.pluggy_client_id;
          delete basicData.pluggy_client_secret;
          delete basicData.pluggy_enabled;

          const { error: retryError } = await supabase
            .from('global_settings')
            .insert(basicData);

          if (retryError) throw retryError;
          console.log('Successfully inserted without new fields. Note: Pluggy settings require migration 050_add_pluggy_settings.sql');
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

/**
 * Get plan features for a specific plan
 */
export async function getPlanFeatures(plan: 'free' | 'pro' | 'premium'): Promise<PlanFeatures> {
  const settings = await getGlobalSettings();
  const featuresKey = `plan_features_${plan}` as keyof GlobalSettings;
  const features = settings[featuresKey] as PlanFeatures | null | undefined;
  
  if (!features) {
    // Return empty features if not configured
    return {};
  }
  
  return features;
}

/**
 * Get all plan features
 */
export async function getAllPlanFeatures(): Promise<{
  free: PlanFeatures;
  pro: PlanFeatures;
  premium: PlanFeatures;
}> {
  const settings = await getGlobalSettings();
  
  return {
    free: (settings.plan_features_free as PlanFeatures) || {},
    pro: (settings.plan_features_pro as PlanFeatures) || {},
    premium: (settings.plan_features_premium as PlanFeatures) || {},
  };
}

/**
 * Get plan display configuration
 */
export async function getPlanDisplayConfig(): Promise<PlanDisplayConfig> {
  const settings = await getGlobalSettings();
  return (settings.plan_display_config as PlanDisplayConfig) || {};
}

/**
 * Update plan features for a specific plan
 */
export async function updatePlanFeatures(
  plan: 'free' | 'pro' | 'premium',
  features: PlanFeatures
): Promise<void> {
  const updates: Partial<GlobalSettings> = {};
  updates[`plan_features_${plan}` as keyof GlobalSettings] = features as any;
  await updateGlobalSettings(updates);
}

/**
 * Update plan display configuration
 */
export async function updatePlanDisplayConfig(config: PlanDisplayConfig): Promise<void> {
  await updateGlobalSettings({ plan_display_config: config });
}


