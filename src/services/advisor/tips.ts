/**
 * Tips Service
 * Handles daily tips generation and caching
 */

import { createClient } from '@/lib/supabase/server';
import { buildFinancialContext } from './contextBuilder';
import { getDailyTip, areTipsEnabled } from './llm';
import { AdvisorResponse } from './types';
import { format, startOfDay, endOfDay } from 'date-fns';

/**
 * Get or generate daily tip for a user
 * Returns cached tip if available, otherwise generates new one
 */
export async function getOrGenerateDailyTip(userId: string): Promise<{
  tip: AdvisorResponse | null;
  isNew: boolean;
  cached: boolean;
  error?: string;
}> {
  // Check if tips are enabled
  const tipsEnabled = await areTipsEnabled();
  if (!tipsEnabled) {
    return {
      tip: null,
      isNew: false,
      cached: false,
      error: 'Tips estão desabilitadas no momento',
    };
  }

  const supabase = await createClient();
  const today = new Date();
  const todayStart = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const todayEnd = format(endOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");

  try {
    // Try to check for existing tip today (with or without insight_type column)
    let existingTip = null;
    let fetchError = null;

    // First try with insight_type filter to get only daily tips (not chat responses)
    const result = await supabase
      .from('advisor_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('insight_type', 'daily_tip')
      .gte('created_at', todayStart)
      .lt('created_at', todayEnd)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    existingTip = result.data;
    fetchError = result.error;

    if (existingTip && !fetchError) {
      // Return cached tip
      return {
        tip: {
          summary: existingTip.summary || '',
          insights: existingTip.insights || [],
          actions: existingTip.actions || [],
          confidence: existingTip.confidence || 'medium',
          citations: existingTip.citations || [],
        },
        isNew: false,
        cached: true,
      };
    }

    // Generate new tip
    const context = await buildFinancialContext(userId);
    const contextJson = JSON.stringify(context, null, 2);
    const tip = await getDailyTip(contextJson, userId);

    // Save to database - try with insight_type first, fallback without it
    try {
      const { error: insertError } = await supabase
        .from('advisor_insights')
        .insert({
          user_id: userId,
          summary: tip.summary,
          insights: tip.insights,
          actions: tip.actions,
          confidence: tip.confidence,
          citations: tip.citations,
          insight_type: 'daily_tip',
        });

      if (insertError) {
        // If insight_type column doesn't exist, try without it
        if (insertError.code === '42703' || insertError.message?.includes('insight_type')) {
          await supabase
            .from('advisor_insights')
            .insert({
              user_id: userId,
              summary: tip.summary,
              insights: tip.insights,
              actions: tip.actions,
              confidence: tip.confidence,
              citations: tip.citations,
            });
        } else {
          console.error('Error saving tip:', insertError);
        }
      }
    } catch (saveError) {
      console.error('Error saving tip:', saveError);
      // Still return the tip even if save failed
    }

    return {
      tip,
      isNew: true,
      cached: false,
    };
  } catch (error) {
    console.error('Error getting/generating tip:', error);
    return {
      tip: null,
      isNew: false,
      cached: false,
      error: 'Erro ao gerar dica do dia',
    };
  }
}

/**
 * Get the last N tips for a user
 */
export async function getRecentTips(
  userId: string,
  limit: number = 7
): Promise<AdvisorResponse[]> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from('advisor_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('insight_type', 'daily_tip')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent tips:', error);
      return [];
    }

    return (data || []).map(row => ({
      summary: row.summary || '',
      insights: row.insights || [],
      actions: row.actions || [],
      confidence: row.confidence || 'medium',
      citations: row.citations || [],
    }));
  } catch (error) {
    console.error('Error in getRecentTips:', error);
    return [];
  }
}

/**
 * Check if user has a tip for today
 */
export async function hasTipToday(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const today = new Date();
  const todayStart = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");

  try {
    const { count, error } = await supabase
      .from('advisor_insights')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('insight_type', 'daily_tip')
      .gte('created_at', todayStart);

    if (error) {
      console.error('Error checking tip:', error);
      return false;
    }

    return (count || 0) > 0;
  } catch (error) {
    console.error('Error in hasTipToday:', error);
    return false;
  }
}

/**
 * Force regenerate tip for today (admin use)
 */
export async function regenerateTip(userId: string): Promise<AdvisorResponse | null> {
  const supabase = await createClient();
  const today = new Date();
  const todayStart = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");

  try {
    // Delete existing tip for today
    await supabase
      .from('advisor_insights')
      .delete()
      .eq('user_id', userId)
      .eq('insight_type', 'daily_tip')
      .gte('created_at', todayStart);

    // Generate new tip
    const context = await buildFinancialContext(userId);
    const contextJson = JSON.stringify(context, null, 2);
    const tip = await getDailyTip(contextJson, userId);

    // Save to database
    await supabase
      .from('advisor_insights')
      .insert({
        user_id: userId,
        summary: tip.summary,
        insights: tip.insights,
        actions: tip.actions,
        confidence: tip.confidence,
        citations: tip.citations,
        insight_type: 'daily_tip',
      });

    return tip;
  } catch (error) {
    console.error('Error regenerating tip:', error);
    return null;
  }
}
