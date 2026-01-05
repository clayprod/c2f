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
 * Keeps system messages and recent conversations, summarizes older ones
 */
export async function optimizeHistory(
  session: ChatSession,
  maxTokens: number = 4000
): Promise<ChatMessage[]> {
  const messages = session.messages;

  if (estimateTokenCount(messages) <= maxTokens) {
    return messages;
  }

  // Strategy: Keep last 5 user-assistant pairs, summarize the rest
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  // Keep last 10 messages (5 pairs)
  const recentMessages = conversationMessages.slice(-10);
  const oldMessages = conversationMessages.slice(0, -10);

  // If still too many tokens, truncate further
  if (estimateTokenCount([...systemMessages, ...recentMessages]) > maxTokens) {
    return [...systemMessages, ...recentMessages.slice(-6)];
  }

  // Create a summary of old messages if they exist
  if (oldMessages.length > 0) {
    const summary: ChatMessage = {
      role: 'system',
      content: `[Resumo da conversa anterior: O usuário fez ${oldMessages.filter(m => m.role === 'user').length} perguntas sobre suas finanças. Principais tópicos discutidos foram analisados e as recomendações já foram fornecidas.]`,
      timestamp: new Date().toISOString(),
    };
    return [...systemMessages, summary, ...recentMessages];
  }

  return [...systemMessages, ...recentMessages];
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
 */
export function buildMessagesForLLM(
  session: ChatSession,
  systemPrompt: string,
  newUserMessage: string,
  financialContext: string
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // System prompt with financial context
  messages.push({
    role: 'system',
    content: `${systemPrompt}\n\n---\n\nDADOS FINANCEIROS DO USUÁRIO:\n${financialContext}`,
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
