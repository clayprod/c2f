import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { advisorChatSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
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
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = advisorChatSchema.parse(body);

    // Extract session ID from body if provided
    const sessionId = body.sessionId as string | undefined;

    // Get or create session
    const session = await getOrCreateSession(userId, sessionId);

    // Build financial context
    const context = await buildFinancialContext(userId);
    const contextJson = JSON.stringify(context, null, 2);
    const newContextHash = hashContext(context);

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
    const conversationHistory: ChatMessage[] = sessionMessages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role,
        content: m.content,
      }));

    // Get advisor response using new service
    const advisorResponse = await getAdvisorResponse(
      validated.message,
      contextJson,
      conversationHistory,
      userId
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

    // Save insight to database for history (try with insight_type, fallback without)
    const supabase = await createClient();
    try {
      const { error: insertError } = await supabase.from('advisor_insights').insert({
        user_id: userId,
        summary: advisorResponse.summary,
        insights: advisorResponse.insights,
        actions: advisorResponse.actions,
        confidence: advisorResponse.confidence,
        citations: advisorResponse.citations,
        insight_type: 'chat',
      });

      if (insertError) {
        // If insight_type column doesn't exist, try without it
        if (insertError.code === '42703' || insertError.message?.includes('insight_type')) {
          await supabase.from('advisor_insights').insert({
            user_id: userId,
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
    const userId = await getUserId();
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
