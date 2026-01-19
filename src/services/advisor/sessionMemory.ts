/**
 * Session Memory Service
 * Manages chat sessions in Redis for conversation memory
 * Supports both direct Redis (ioredis) and Upstash Redis
 */

import Redis from 'ioredis';
import { ChatSession, ChatMessage } from './types';
import { getGlobalSettings } from '@/services/admin/globalSettings';

// Redis client singleton
let redisClient: Redis | null = null;
let connectionAttempted = false;

/**
 * Get or create Redis client
 * Connects using REDIS_URL environment variable
 */
async function getRedisClient(): Promise<Redis | null> {
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  if (connectionAttempted && !redisClient) {
    return null;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn('REDIS_URL not configured, session memory disabled');
    connectionAttempted = true;
    return null;
  }

  try {
    connectionAttempted = true;
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
    });

    await redisClient.connect();
    console.log('Redis connected successfully');
    return redisClient;
  } catch (error) {
    console.error('Redis connection failed:', error);
    redisClient = null;
    return null;
  }
}

/**
 * Generate session key for Redis
 */
function getSessionKey(userId: string, sessionId: string): string {
  return `advisor:session:${userId}:${sessionId}`;
}

/**
 * Generate user sessions index key
 */
function getUserSessionsKey(userId: string): string {
  return `advisor:sessions:${userId}`;
}

/**
 * Get session TTL from settings or use default
 */
async function getSessionTTL(): Promise<number> {
  try {
    const settings = await getGlobalSettings();
    const ttlMinutes = (settings as any).session_ttl_minutes || 30;
    return ttlMinutes * 60; // Convert to seconds
  } catch {
    return 30 * 60; // Default 30 minutes
  }
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get or create a chat session
 */
export async function getOrCreateSession(
  userId: string,
  sessionId?: string
): Promise<ChatSession> {
  const redis = await getRedisClient();
  const sid = sessionId || generateSessionId();
  const key = getSessionKey(userId, sid);
  const now = new Date().toISOString();

  // If Redis is not available, create in-memory session
  if (!redis) {
    return {
      id: sid,
      userId,
      createdAt: now,
      updatedAt: now,
      messages: [],
      contextHash: '',
      tokenCount: 0,
    };
  }

  try {
    // Try to get existing session
    const existing = await redis.get(key);

    if (existing) {
      const session: ChatSession = JSON.parse(existing);
      session.updatedAt = now;

      // Refresh TTL
      const ttl = await getSessionTTL();
      await redis.expire(key, ttl);

      return session;
    }

    // Create new session
    const session: ChatSession = {
      id: sid,
      userId,
      createdAt: now,
      updatedAt: now,
      messages: [],
      contextHash: '',
      tokenCount: 0,
    };

    const ttl = await getSessionTTL();
    await redis.setex(key, ttl, JSON.stringify(session));

    // Add to user's session index
    await redis.sadd(getUserSessionsKey(userId), sid);
    await redis.expire(getUserSessionsKey(userId), ttl * 2);

    return session;
  } catch (error) {
    console.error('Error getting/creating session:', error);
    // Return fallback session
    return {
      id: sid,
      userId,
      createdAt: now,
      updatedAt: now,
      messages: [],
      contextHash: '',
      tokenCount: 0,
    };
  }
}

/**
 * Add a message to the session
 */
export async function addMessage(
  userId: string,
  sessionId: string,
  message: ChatMessage
): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  const key = getSessionKey(userId, sessionId);

  try {
    const existing = await redis.get(key);
    if (!existing) return;

    const session: ChatSession = JSON.parse(existing);
    session.messages.push({
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    });
    session.updatedAt = new Date().toISOString();
    session.tokenCount = estimateTokenCount(session.messages);

    const ttl = await getSessionTTL();
    await redis.setex(key, ttl, JSON.stringify(session));
  } catch (error) {
    console.error('Error adding message:', error);
  }
}

/**
 * Update session with multiple messages
 */
export async function updateSession(
  userId: string,
  sessionId: string,
  updates: Partial<ChatSession>
): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  const key = getSessionKey(userId, sessionId);

  try {
    const existing = await redis.get(key);
    if (!existing) return;

    const session: ChatSession = JSON.parse(existing);
    Object.assign(session, updates, { updatedAt: new Date().toISOString() });

    const ttl = await getSessionTTL();
    await redis.setex(key, ttl, JSON.stringify(session));
  } catch (error) {
    console.error('Error updating session:', error);
  }
}

/**
 * Optimize message history when token count exceeds limit
 * Keeps system messages and recent conversations, summarizes older ones with semantic extraction
 */
export async function optimizeHistory(
  session: ChatSession,
  maxTokens: number = 4000
): Promise<ChatMessage[]> {
  const messages = session.messages;

  if (estimateTokenCount(messages) <= maxTokens) {
    return messages;
  }

  // Strategy: Keep last 5 user-assistant pairs, summarize the rest with semantic extraction
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  // Keep last 10 messages (5 pairs)
  const recentMessages = conversationMessages.slice(-10);
  const oldMessages = conversationMessages.slice(0, -10);

  // If still too many tokens, truncate further
  if (estimateTokenCount([...systemMessages, ...recentMessages]) > maxTokens) {
    return [...systemMessages, ...recentMessages.slice(-6)];
  }

  // Create a semantic summary of old messages if they exist
  if (oldMessages.length > 0) {
    const summary = createConversationSummary(oldMessages);
    const summaryMessage: ChatMessage = {
      role: 'system',
      content: summary,
      timestamp: new Date().toISOString(),
    };
    return [...systemMessages, summaryMessage, ...recentMessages];
  }

  return [...systemMessages, ...recentMessages];
}

/**
 * Create a semantic summary of conversation messages
 * Extracts topics, decisions, and key numbers mentioned
 */
function createConversationSummary(messages: ChatMessage[]): string {
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  // Extract potential topics from user messages
  const topics: string[] = [];
  const keywords = [
    'orçamento', 'meta', 'dívida', 'investimento', 'gasto', 'economia', 
    'poupança', 'salário', 'renda', 'despesa', 'cartão', 'fatura',
    'reserva', 'emergência', 'aposentadoria', 'compra', 'viagem'
  ];
  
  for (const msg of userMessages) {
    const content = msg.content.toLowerCase();
    for (const keyword of keywords) {
      if (content.includes(keyword) && !topics.includes(keyword)) {
        topics.push(keyword);
        if (topics.length >= 5) break;
      }
    }
  }

  // Extract numbers that might be monetary values (R$ or high numbers)
  const numbers: string[] = [];
  const numberPattern = /R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/g;
  for (const msg of [...userMessages, ...assistantMessages]) {
    const matches = msg.content.match(numberPattern);
    if (matches) {
      for (const match of matches.slice(0, 3)) {
        if (!numbers.includes(match)) {
          numbers.push(match);
          if (numbers.length >= 5) break;
        }
      }
    }
  }

  // Build summary
  const parts: string[] = [
    `[Resumo da conversa anterior: ${userMessages.length} pergunta(s), ${assistantMessages.length} resposta(s).`,
  ];
  
  if (topics.length > 0) {
    parts.push(`Tópicos: ${topics.join(', ')}.`);
  }
  
  if (numbers.length > 0) {
    parts.push(`Valores mencionados: ${numbers.join(', ')}.`);
  }
  
  parts.push('Recomendações anteriores já foram fornecidas.]');

  return parts.join(' ');
}

/**
 * Estimate token count for messages
 * Rough estimation: 1 token ≈ 4 characters for Portuguese
 */
export function estimateTokenCount(messages: ChatMessage[]): number {
  const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  return Math.ceil(totalChars / 4);
}

/**
 * Clear a specific session
 */
export async function clearSession(userId: string, sessionId: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  const key = getSessionKey(userId, sessionId);

  try {
    await redis.del(key);
    await redis.srem(getUserSessionsKey(userId), sessionId);
  } catch (error) {
    console.error('Error clearing session:', error);
  }
}

/**
 * List all active sessions for a user
 */
export async function listUserSessions(userId: string): Promise<string[]> {
  const redis = await getRedisClient();
  if (!redis) return [];

  try {
    return await redis.smembers(getUserSessionsKey(userId));
  } catch (error) {
    console.error('Error listing sessions:', error);
    return [];
  }
}

/**
 * Get a specific session by ID
 */
export async function getSession(
  userId: string,
  sessionId: string
): Promise<ChatSession | null> {
  const redis = await getRedisClient();
  if (!redis) return null;

  const key = getSessionKey(userId, sessionId);

  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;

  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Build messages array for LLM call including session history
 * Optimizes context by sending summarized version when context hash hasn't changed
 */
export function buildMessagesForLLM(
  session: ChatSession,
  systemPrompt: string,
  newUserMessage: string,
  financialContext: string,
  contextHash: string,
  summarizedContext?: string
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // Determine if we need full context or can use summarized version
  const isFirstMessage = session.messages.length === 0;
  const contextChanged = session.contextHash !== contextHash;
  const useFullContext = isFirstMessage || contextChanged || !summarizedContext;

  // System prompt with financial context (full or summarized)
  const contextToUse = useFullContext ? financialContext : summarizedContext;
  const contextLabel = useFullContext 
    ? 'DADOS FINANCEIROS DO USUÁRIO' 
    : 'RESUMO FINANCEIRO (contexto completo enviado anteriormente)';

  messages.push({
    role: 'system',
    content: `${systemPrompt}\n\n---\n\n${contextLabel}:\n${contextToUse}`,
  });

  // Add conversation history (already optimized)
  for (const msg of session.messages) {
    if (msg.role !== 'system') {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Add new user message
  messages.push({
    role: 'user',
    content: newUserMessage,
  });

  return messages;
}

/**
 * Create a summarized version of the financial context for subsequent messages
 * Includes only snapshot, alerts, and key metrics to reduce tokens
 */
export function createSummarizedContext(fullContext: Record<string, unknown>): string {
  const summary: Record<string, unknown> = {
    user: fullContext.user,
    snapshot: fullContext.snapshot,
    alerts: fullContext.alerts,
    // Include counts for reference
    _counts: {
      accounts: Array.isArray(fullContext.accounts) ? fullContext.accounts.length : 0,
      budgets: Array.isArray(fullContext.budgets) ? fullContext.budgets.length : 0,
      goals: Array.isArray(fullContext.goals) ? fullContext.goals.length : 0,
      debts: Array.isArray(fullContext.debts) ? fullContext.debts.length : 0,
      receivables: Array.isArray(fullContext.receivables) ? fullContext.receivables.length : 0,
      investments: Array.isArray(fullContext.investments) ? fullContext.investments.length : 0,
    },
  };

  return JSON.stringify(summary, null, 2);
}
