/**
 * AI Advisor Service
 * Main exports for the advisor module
 */

// Types
export type {
  AdvisorResponse,
  AdvisorInsight,
  AdvisorAction,
  AdvisorCitation,
  ChatMessage,
  ChatSession,
  FinancialContext,
  LLMCallParams,
  LLMResponse,
} from './types';

// Context Builder
export {
  buildFinancialContext,
  hashContext,
} from './contextBuilder';

// Session Memory
export {
  getOrCreateSession,
  addMessage,
  updateSession,
  optimizeHistory,
  estimateTokenCount,
  clearSession,
  listUserSessions,
  getSession,
  isRedisAvailable,
  buildMessagesForLLM,
  createSummarizedContext,
} from './sessionMemory';

// LLM
export {
  callLLM,
  getAdvisorResponse,
  getDailyTip,
  getAPIConfig,
  areTipsEnabled,
  getMaxHistoryTokens,
} from './llm';

// Tips
export {
  getOrGenerateDailyTip,
  getRecentTips,
  hasTipToday,
  regenerateTip,
} from './tips';

// Prompts
export {
  DEFAULT_ADVISOR_PROMPT,
  DEFAULT_TIPS_PROMPT,
  MODELS,
} from './prompts';

// Dynamic Models
export {
  fetchGroqModels,
  fetchOpenAIModels,
  getModelsForProvider,
  clearModelsCache,
  type ModelInfo,
} from './models';
