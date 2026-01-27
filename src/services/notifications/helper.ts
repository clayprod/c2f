import { createClient } from '@/lib/supabase/server';

export interface NotificationData {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Check if notification should be sent based on frequency rules
 */
export async function shouldSendNotification(
  userId: string,
  ruleType: string,
  entityId: string | null,
  frequencyHours: number,
  options?: { supabase?: any }
): Promise<boolean> {
  const supabase = options?.supabase ?? await createClient();

  if (!entityId) {
    // For notifications without entity, check last sent time
    const { data: log } = await supabase
      .from('notification_sent_log')
      .select('last_sent_at')
      .eq('user_id', userId)
      .eq('rule_type', ruleType)
      .is('entity_id', null)
      .single();

    if (!log) return true;

    const lastSent = new Date(log.last_sent_at);
    const now = new Date();
    const hoursSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastSent >= frequencyHours;
  }

  // For notifications with entity, check last sent time for that specific entity
  const { data: log } = await supabase
    .from('notification_sent_log')
    .select('last_sent_at')
    .eq('user_id', userId)
    .eq('rule_type', ruleType)
    .eq('entity_id', entityId)
    .single();

  if (!log) return true;

  const lastSent = new Date(log.last_sent_at);
  const now = new Date();
  const hoursSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

  return hoursSinceLastSent >= frequencyHours;
}

/**
 * Create a notification in the database
 */
export async function createNotification(
  userId: string,
  notificationData: NotificationData,
  options?: { supabase?: any }
): Promise<string | null> {
  const supabase = options?.supabase ?? await createClient();

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type,
      link: notificationData.link || null,
      metadata: notificationData.metadata || {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    return null;
  }

  return data.id;
}

/**
 * Update notification sent log
 */
export async function updateNotificationSentLog(
  userId: string,
  ruleType: string,
  entityId: string | null,
  entityType?: string,
  options?: { supabase?: any }
): Promise<void> {
  const supabase = options?.supabase ?? await createClient();

  const logData: any = {
    user_id: userId,
    rule_type: ruleType,
    last_sent_at: new Date().toISOString(),
  };

  if (entityId) {
    logData.entity_id = entityId;
  }

  if (entityType) {
    logData.entity_type = entityType;
  }

  const { error } = await supabase
    .from('notification_sent_log')
    .upsert(logData, {
      onConflict: 'user_id,rule_type,entity_id',
    });

  if (error) {
    console.error('Error updating notification sent log:', error);
  }
}

/**
 * Format currency value from cents to reais
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Calculate days until date
 */
export function daysUntil(date: Date | string): number {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
