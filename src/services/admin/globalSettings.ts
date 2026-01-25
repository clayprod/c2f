/**
 * Global Settings Service
 * Manages global system settings with fallback to environment variables
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/encryption';

/**
 * Safe decrypt that returns fallback on error
 * This handles cases where encryption algorithm mismatch or key mismatch occurs
 */
function safeDecrypt(encryptedValue: string | null | undefined, fallbackValue: string | null | undefined): string | null {
  if (!encryptedValue) {
    return fallbackValue ?? null;
  }
  try {
    const decrypted = decrypt(encryptedValue);
    return decrypted ?? fallbackValue ?? null;
  } catch (error) {
    console.warn('[GlobalSettings] Decryption failed, using fallback value:', error);
    return fallbackValue ?? null;
  }
}

export interface PlanFeature {
  enabled: boolean;
  text?: string;
  limit?: number;
  unlimited?: boolean;
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
    originalPrice?: number | null; // Preço "de" em centavos (ex: 8990 = R$89,90)
  };
  pro?: {
    name?: string;
    description?: string;
    period?: string;
    cta?: string;
    popular?: boolean;
    originalPrice?: number | null; // Preço "de" em centavos (ex: 8990 = R$89,90)
  };
  premium?: {
    name?: string;
    description?: string;
    period?: string;
    cta?: string;
    popular?: boolean;
    originalPrice?: number | null; // Preço "de" em centavos (ex: 8990 = R$89,90)
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

    // Define columns - all columns that exist in the current database schema
    const allColumns = 'support_email, support_whatsapp, smtp_host, smtp_port, smtp_user, smtp_password, smtp_password_encrypted, smtp_from_email, smtp_secure, groq_api_key, groq_api_key_encrypted, openai_api_key, openai_api_key_encrypted, ai_model, ai_model_name, advisor_prompt, tips_prompt, categorization_prompt, tips_enabled, chat_max_tokens, session_ttl_minutes, stripe_price_id_pro, stripe_price_id_business, advisor_limit_pro, advisor_limit_premium, evolution_api_url, evolution_api_key, evolution_api_key_encrypted, evolution_instance_name, evolution_webhook_secret, evolution_webhook_secret_encrypted, n8n_api_key, n8n_api_key_encrypted, whatsapp_enabled, pluggy_client_id, pluggy_client_secret, pluggy_client_secret_encrypted, pluggy_enabled, plan_features_free, plan_features_pro, plan_features_premium, plan_display_config';
    // Minimal columns for fallback (in case some columns don't exist)
    const minimalColumns = 'support_email, support_whatsapp, smtp_host, smtp_port, smtp_user, smtp_password, smtp_password_encrypted, smtp_from_email, groq_api_key, groq_api_key_encrypted, openai_api_key, openai_api_key_encrypted, ai_model, ai_model_name, advisor_prompt, tips_prompt, tips_enabled, chat_max_tokens, session_ttl_minutes, stripe_price_id_pro, stripe_price_id_business';

    let { data, error } = await supabase
      .from('global_settings')
      .select(allColumns)
      .order('updated_at', { ascending: false })
      .limit(1);

    console.log('[GlobalSettings] Query result - error:', error);
    const logRow = Array.isArray(data) ? data[0] : data;
    console.log('[GlobalSettings] Query result - data exists:', !!logRow);
    if (logRow) {
      console.log('[GlobalSettings] Query result - support_email:', logRow.support_email);
      console.log('[GlobalSettings] Query result - smtp_host:', logRow.smtp_host);
      console.log('[GlobalSettings] Query result - ai_model:', logRow.ai_model);
      console.log('[GlobalSettings] Query result - advisor_limit_pro:', logRow.advisor_limit_pro);
    }

    // If column doesn't exist (42703), retry with minimal columns
    if (error && error.code === '42703') {
      console.log('[GlobalSettings] Some columns missing, retrying with minimal columns');
      const retryResult = await supabase
        .from('global_settings')
        .select(minimalColumns)
        .order('updated_at', { ascending: false })
        .limit(1);
      data = retryResult.data as typeof data;
      error = retryResult.error;
    }

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[GlobalSettings] Error fetching global settings:', error);
    }

    const settings: GlobalSettings = {};

    const row = Array.isArray(data) ? data[0] : data;

    if (row) {
      // Use database values if available
      settings.smtp_host = row.smtp_host;
      settings.smtp_port = row.smtp_port;
      settings.smtp_user = row.smtp_user;
      // Decrypt sensitive fields if encrypted columns exist, otherwise use plain columns
      settings.smtp_password = safeDecrypt(row.smtp_password_encrypted, row.smtp_password);
      settings.smtp_from_email = row.smtp_from_email;
      settings.smtp_secure = row.smtp_secure;
      settings.groq_api_key = safeDecrypt(row.groq_api_key_encrypted, row.groq_api_key);
      settings.openai_api_key = safeDecrypt(row.openai_api_key_encrypted, row.openai_api_key);
      settings.ai_model = row.ai_model as 'groq' | 'openai' | null;
      settings.ai_model_name = row.ai_model_name;
      settings.advisor_prompt = row.advisor_prompt;
      settings.tips_prompt = row.tips_prompt;
      settings.tips_enabled = row.tips_enabled;
      settings.chat_max_tokens = row.chat_max_tokens;
      settings.session_ttl_minutes = row.session_ttl_minutes;
      settings.stripe_price_id_pro = row.stripe_price_id_pro;
      settings.stripe_price_id_business = row.stripe_price_id_business;
      settings.advisor_limit_pro = row.advisor_limit_pro;
      settings.advisor_limit_premium = row.advisor_limit_premium;
      settings.support_email = row.support_email;
      settings.support_whatsapp = row.support_whatsapp;
      // Evolution API / WhatsApp Integration
      settings.evolution_api_url = row.evolution_api_url;
      settings.evolution_api_key = safeDecrypt(row.evolution_api_key_encrypted, row.evolution_api_key);
      settings.evolution_instance_name = row.evolution_instance_name;
      settings.evolution_webhook_secret = safeDecrypt(row.evolution_webhook_secret_encrypted, row.evolution_webhook_secret);
      settings.n8n_api_key = safeDecrypt(row.n8n_api_key_encrypted, row.n8n_api_key);
      settings.whatsapp_enabled = row.whatsapp_enabled;
      // Pluggy / Open Finance Integration
      settings.pluggy_client_id = row.pluggy_client_id;
      settings.pluggy_client_secret = safeDecrypt(row.pluggy_client_secret_encrypted, row.pluggy_client_secret);
      settings.pluggy_enabled = row.pluggy_enabled;
      settings.categorization_prompt = row.categorization_prompt;
      // Plan Features
      settings.plan_features_free = row.plan_features_free as PlanFeatures | null;
      settings.plan_features_pro = row.plan_features_pro as PlanFeatures | null;
      settings.plan_features_premium = row.plan_features_premium as PlanFeatures | null;
      settings.plan_display_config = row.plan_display_config as PlanDisplayConfig | null;

      console.log('[GlobalSettings] Fetched settings:', {
        hasSupportEmail: !!row.support_email,
        hasSupportWhatsapp: !!row.support_whatsapp,
        supportEmail: row.support_email,
        supportWhatsapp: row.support_whatsapp,
        // Pluggy debug
        hasPluggyClientId: !!row.pluggy_client_id,
        hasPluggyClientSecret: !!row.pluggy_client_secret,
        pluggyEnabled: row.pluggy_enabled,
        // Plan Features debug
        hasPlanFeaturesFree: !!row.plan_features_free,
        planFeaturesFreeKeys: row.plan_features_free ? Object.keys(row.plan_features_free) : [],
        planFeaturesFreeBudgets: row.plan_features_free?.budgets,
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

  // Get existing settings rows (global_settings is a singleton table)
  const { data: existingRows, error: existingError } = await supabase
    .from('global_settings')
    .select('id');

  if (existingError) {
    console.error('[GlobalSettings] Error loading existing rows:', existingError);
    console.error('[GlobalSettings] Error code:', existingError.code);
    console.error('[GlobalSettings] Error details:', existingError.details);
    console.error('[GlobalSettings] Error hint:', existingError.hint);
    // If we can't read existing rows, we can't proceed
    throw new Error(`Erro ao acessar configurações globais: ${existingError.message}`);
  }

  const existingIds = (existingRows || []).map((row) => row.id);

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
  // Plan Features - clean up undefined values before saving
  if (updates.plan_features_free !== undefined) {
    console.log('[GlobalSettings] Updating plan_features_free:', JSON.stringify(updates.plan_features_free, null, 2));
    // Remove undefined values from nested objects to avoid JSONB issues
    const cleanedFree = JSON.parse(JSON.stringify(updates.plan_features_free, (key, value) => 
      value === undefined ? null : value
    ));
    updateData.plan_features_free = cleanedFree;
  }
  if (updates.plan_features_pro !== undefined) {
    console.log('[GlobalSettings] Updating plan_features_pro:', JSON.stringify(updates.plan_features_pro, null, 2));
    const cleanedPro = JSON.parse(JSON.stringify(updates.plan_features_pro, (key, value) => 
      value === undefined ? null : value
    ));
    updateData.plan_features_pro = cleanedPro;
  }
  if (updates.plan_features_premium !== undefined) {
    console.log('[GlobalSettings] Updating plan_features_premium:', JSON.stringify(updates.plan_features_premium, null, 2));
    const cleanedPremium = JSON.parse(JSON.stringify(updates.plan_features_premium, (key, value) => 
      value === undefined ? null : value
    ));
    updateData.plan_features_premium = cleanedPremium;
  }
  if (updates.plan_display_config !== undefined) {
    console.log('[GlobalSettings] Updating plan_display_config:', JSON.stringify(updates.plan_display_config, null, 2));
    const cleanedDisplay = JSON.parse(JSON.stringify(updates.plan_display_config, (key, value) => 
      value === undefined ? null : value
    ));
    updateData.plan_display_config = cleanedDisplay;
  }

  updateData.updated_at = new Date().toISOString();

  try {
    console.log('updateGlobalSettings - updateData keys:', Object.keys(updateData));
    console.log('updateGlobalSettings - smtp_secure value:', updateData.smtp_secure);
    
    if (existingIds.length > 0) {
      const { error } = await supabase
        .from('global_settings')
        .update(updateData)
        .in('id', existingIds);

      if (error) {
        console.error('Error updating global_settings:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        
        // Check for trigger-related errors (often caused by audit trigger trying to access user_id)
        if (error.message?.includes('user_id') && error.message?.includes('does not exist')) {
          const triggerError = new Error(
            'Erro no trigger de auditoria. A tabela global_settings não possui coluna user_id. ' +
            'Execute a migration 068_fix_global_settings_audit_trigger.sql no Supabase para corrigir.'
          );
          (triggerError as any).code = 'AUDIT_TRIGGER_ERROR';
          throw triggerError;
        }
        
        // If columns don't exist, try without the new fields
        if (error.code === '42703' || error.message?.includes('column')) {
          // Check if Pluggy fields are being updated - if so, throw a specific error
          const hasPluggyFields = updateData.pluggy_client_id !== undefined || 
                                  updateData.pluggy_client_secret !== undefined || 
                                  updateData.pluggy_enabled !== undefined;
          
          if (hasPluggyFields && (error.message?.includes('pluggy') || error.message?.includes('categorization'))) {
            const pluggyError = new Error('Colunas Pluggy não encontradas no banco de dados. Execute a migration 050_add_pluggy_settings.sql no Supabase.');
            (pluggyError as any).code = 'PLUGGY_MIGRATION_REQUIRED';
            throw pluggyError;
          }
          
          console.log('Column error detected, retrying without new fields. Error:', error.message);
          const basicData = { ...updateData };
          // Remove fields that may not exist in older database schemas
          delete basicData.tips_prompt;
          delete basicData.tips_enabled;
          delete basicData.chat_max_tokens;
          delete basicData.session_ttl_minutes;
          delete basicData.smtp_secure;
          delete basicData.categorization_prompt;
          delete basicData.updated_at;
          // Pluggy fields (added in migration 050)
          delete basicData.pluggy_client_id;
          delete basicData.pluggy_client_secret;
          delete basicData.pluggy_enabled;

          const { error: retryError } = await supabase
            .from('global_settings')
            .update(basicData)
            .in('id', existingIds);

          if (retryError) {
            console.error('Retry error:', retryError);
            throw retryError;
          }
          console.log('Successfully updated without new fields. Note: Pluggy settings require migration 050_add_pluggy_settings.sql');
        } else {
          throw error;
        }
      } else {
        console.log('[GlobalSettings] Successfully updated global_settings');
        console.log('[GlobalSettings] Updated fields:', Object.keys(updateData));
      }
    } else {
      const { error } = await supabase
        .from('global_settings')
        .insert(updateData);

      if (error) {
        console.error('Error inserting global_settings:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Check for trigger-related errors (often caused by audit trigger trying to access user_id)
        if (error.message?.includes('user_id') && error.message?.includes('does not exist')) {
          const triggerError = new Error(
            'Erro no trigger de auditoria. A tabela global_settings não possui coluna user_id. ' +
            'Execute a migration 068_fix_global_settings_audit_trigger.sql no Supabase para corrigir.'
          );
          (triggerError as any).code = 'AUDIT_TRIGGER_ERROR';
          throw triggerError;
        }
        
        // If columns don't exist, try without the new fields
        if (error.code === '42703' || error.message?.includes('column')) {
          // Check if Pluggy fields are being inserted - if so, throw a specific error
          const hasPluggyFields = updateData.pluggy_client_id !== undefined || 
                                  updateData.pluggy_client_secret !== undefined || 
                                  updateData.pluggy_enabled !== undefined;
          
          if (hasPluggyFields && (error.message?.includes('pluggy') || error.message?.includes('categorization'))) {
            const pluggyError = new Error('Colunas Pluggy não encontradas no banco de dados. Execute a migration 050_add_pluggy_settings.sql no Supabase.');
            (pluggyError as any).code = 'PLUGGY_MIGRATION_REQUIRED';
            throw pluggyError;
          }
          
          console.log('Column error on insert, retrying without new fields. Error:', error.message);
          const basicData = { ...updateData };
          delete basicData.tips_prompt;
          delete basicData.tips_enabled;
          delete basicData.chat_max_tokens;
          delete basicData.session_ttl_minutes;
          delete basicData.smtp_secure;
          delete basicData.categorization_prompt;
          delete basicData.updated_at;
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
  // Force refresh to get latest data
  const settings = await getGlobalSettings(true);
  
  console.log('[GlobalSettings] getAllPlanFeatures - settings.plan_features_free:', settings.plan_features_free);
  console.log('[GlobalSettings] getAllPlanFeatures - settings.plan_features_free type:', typeof settings.plan_features_free);
  console.log('[GlobalSettings] getAllPlanFeatures - settings.plan_features_free is null?', settings.plan_features_free === null);
  console.log('[GlobalSettings] getAllPlanFeatures - settings.plan_features_free is undefined?', settings.plan_features_free === undefined);
  
  const result = {
    free: (settings.plan_features_free as PlanFeatures) || {},
    pro: (settings.plan_features_pro as PlanFeatures) || {},
    premium: (settings.plan_features_premium as PlanFeatures) || {},
  };
  
  console.log('[GlobalSettings] getAllPlanFeatures - result.free:', result.free);
  console.log('[GlobalSettings] getAllPlanFeatures - result.free budgets:', result.free?.budgets);
  console.log('[GlobalSettings] getAllPlanFeatures - result.free transactions:', result.free?.transactions);
  
  return result;
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
