import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { advisorChatSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { getUserPlanAdmin } from '@/services/stripe/subscription';
import {
  buildFinancialContext,
  getOrCreateSession,
  addMessage,
  updateSession,
  optimizeHistory,
  getAdvisorResponse,
  getMaxHistoryTokens,
  hashContext,
  ChatMessage,
} from '@/services/advisor';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerId = await getEffectiveOwnerId(request, userId);
    const { supabase } = createClientFromRequest(request);
    const admin = createAdminClient();

    // Check Advisor limits
    // Plan must be based on the active (owner) account, not the invitee.
    const userPlan = await getUserPlanAdmin(ownerId);

    // FREE plan has NO access to AI Advisor
    if (userPlan.plan === 'free') {
      return NextResponse.json(
        { error: 'Acesso ao AI Advisor exige um plano Pro ou Premium. Explore nossos planos para desbloquear o poder da IA.' },
        { status: 403 }
      );
    }

    // Get limits from global settings
    const { getGlobalSettings } = await import('@/services/admin/globalSettings');
    const settings = await getGlobalSettings();

    const monthlyLimit = userPlan.plan === 'pro'
      ? (settings.advisor_limit_pro ?? 10)
      : (settings.advisor_limit_premium ?? 100);

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Count against the owner account (and bypass RLS via service role)
    const { count } = await admin
      .from('advisor_insights')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ownerId)
      .gte('created_at', firstDayOfMonth);

    if (count !== null && count >= monthlyLimit) {
      return NextResponse.json(
        { error: `Limite mensal de ${monthlyLimit} consultas ao Advisor atingido no seu plano.` },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = advisorChatSchema.parse(body);

    // Extract session ID from body if provided
    const sessionId = body.sessionId as string | undefined;

    // Get or create session
    const session = await getOrCreateSession(userId, sessionId);

    // Build financial context
    const context = await buildFinancialContext(ownerId);
    const contextJson = JSON.stringify(context, null, 2);
    const newContextHash = hashContext(context);
    
    // Debug log - remove after fixing
    console.log('[Advisor] Context size:', contextJson.length, 'chars');
    console.log('[Advisor] Context snapshot:', JSON.stringify(context.snapshot));
    console.log('[Advisor] Accounts:', context.accounts?.length || 0);
    console.log('[Advisor] Transactions summary:', context.categories_summary?.length || 0);

    // Check if context changed significantly
    const contextChanged = session.contextHash !== newContextHash;
    if (contextChanged) {
      session.contextHash = newContextHash;
    }

    // Get max tokens setting
    const maxTokens = await getMaxHistoryTokens();

    // Optimize history if needed
    let sessionMessages = session.messages;
    if (session.tokenCount > maxTokens) {
      sessionMessages = await optimizeHistory(session, maxTokens);
      await updateSession(userId, session.id, {
        messages: sessionMessages,
        tokenCount: sessionMessages.reduce((sum, m) => sum + (m.content?.length || 0) / 4, 0),
      });
    }

    // Build conversation history from session
    // If session has no messages (Redis unavailable or new session), try to recover from database
    let conversationHistory: ChatMessage[] = [];
    
    if (sessionMessages.length > 0) {
      // Use session messages from Redis
      conversationHistory = sessionMessages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role,
          content: m.content,
        }));
    } else if (sessionId) {
      // Fallback: Try to recover recent chat history from database
      // This helps when Redis is unavailable but sessionId was provided
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentInsights } = await admin
        .from('advisor_insights')
        .select('summary, metadata, created_at')
        .eq('user_id', ownerId)
        .eq('insight_type', 'chat')
        .gte('created_at', thirtyMinutesAgo)
        .order('created_at', { ascending: true })
        .limit(10);

      if (recentInsights && recentInsights.length > 0) {
        // Reconstruct conversation from recent insights with user messages from metadata
        for (const insight of recentInsights) {
          // Add user message if available in metadata
          const userMessage = (insight.metadata as any)?.user_message;
          if (userMessage) {
            conversationHistory.push({
              role: 'user' as const,
              content: userMessage,
            });
          }
          // Add assistant response
          conversationHistory.push({
            role: 'assistant' as const,
            content: insight.summary,
          });
        }
      }
    }

    // Get advisor response using new service
    const advisorResponse = await getAdvisorResponse(
      validated.message,
      contextJson,
      conversationHistory,
      ownerId
    );

    // Save messages to session
    await addMessage(userId, session.id, {
      role: 'user',
      content: validated.message,
    });

    await addMessage(userId, session.id, {
      role: 'assistant',
      content: JSON.stringify(advisorResponse),
    });

    // Save insight to database for history (including user message for reconstruction)
    try {
      const { error: insertError } = await admin.from('advisor_insights').insert({
        user_id: ownerId,
        summary: advisorResponse.summary,
        insights: advisorResponse.insights,
        actions: advisorResponse.actions,
        confidence: advisorResponse.confidence,
        citations: advisorResponse.citations,
        insight_type: 'chat',
        // Store user message and session info for history reconstruction
        metadata: {
          user_message: validated.message,
          session_id: session.id,
          member_id: userId,
        },
      });

      if (insertError) {
        // If metadata or insight_type column doesn't exist, try without them
        if (insertError.code === '42703' || insertError.message?.includes('insight_type') || insertError.message?.includes('metadata')) {
          await admin.from('advisor_insights').insert({
            user_id: ownerId,
            summary: advisorResponse.summary,
            insights: advisorResponse.insights,
            actions: advisorResponse.actions,
            confidence: advisorResponse.confidence,
            citations: advisorResponse.citations,
          });
        } else {
          console.error('Error saving insight:', insertError);
        }
      }
    } catch (saveError) {
      console.error('Error saving insight:', saveError);
      // Continue anyway - the response was already generated
    }

    return NextResponse.json({
      ...advisorResponse,
      sessionId: session.id,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error },
        { status: 400 }
      );
    }
    console.error('Chat API error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

/**
 * DELETE /api/advisor/chat
 * Clear the current chat session
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = body.sessionId as string | undefined;

    if (sessionId) {
      const { clearSession } = await import('@/services/advisor');
      await clearSession(userId, sessionId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clear session error:', error);
    return NextResponse.json({ error: 'Failed to clear session' }, { status: 500 });
  }
}
