'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface AdvisorInsight {
  type?: string;
  message: string;
  severity?: string;
}

interface AdvisorAction {
  type: string;
  description?: string;
  payload?: any;
  confidence?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  insights?: AdvisorInsight[];
  actions?: AdvisorAction[];
  confidence?: string;
}

interface AdvisorResponse {
  summary: string;
  insights: AdvisorInsight[];
  actions: AdvisorAction[];
  confidence: string;
  citations: any[];
  sessionId?: string;
}

interface AdvisorContentProps {
  inDialog?: boolean;
}

// Keys for localStorage persistence
const STORAGE_KEYS = {
  MESSAGES: 'c2f_advisor_messages',
  SESSION_ID: 'c2f_advisor_session_id',
};

// Default welcome message
const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: 'Olá! Sou seu AI Advisor financeiro. Posso ajudar você a entender seus gastos, criar orçamentos, acompanhar objetivos, analisar investimentos e tomar decisões mais inteligentes com seu dinheiro. Como posso ajudar?',
};

export default function AdvisorContent({ inDialog = false }: AdvisorContentProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load persisted chat from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const savedMessages = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      const savedSessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
      
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages) as Message[];
        if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
          setMessages(parsedMessages);
        }
      }
      
      if (savedSessionId) {
        setSessionId(savedSessionId);
      }
    } catch (error) {
      console.error('Error loading persisted chat:', error);
      // If there's an error, clear corrupted data
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    }
    
    setIsInitialized(true);
  }, []);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    } catch (error) {
      console.error('Error persisting messages:', error);
    }
  }, [messages, isInitialized]);

  // Persist sessionId to localStorage whenever it changes
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;
    
    try {
      if (sessionId) {
        localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
      }
    } catch (error) {
      console.error('Error persisting sessionId:', error);
    }
  }, [sessionId, isInitialized]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          // Send sessionId to maintain conversation context on the server
          ...(sessionId && { sessionId }),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao processar mensagem');
      }

      const data: AdvisorResponse = await res.json();

      // Store sessionId for subsequent messages
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.summary,
        insights: data.insights,
        actions: data.actions,
        confidence: data.confidence,
      }]);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível obter resposta do Advisor',
        variant: 'destructive',
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    'Como está minha situação financeira atual?',
    'Quais orçamentos estão acima do limite?',
    'Como estão meus objetivos e metas?',
    'Quais dívidas devo priorizar?',
    'Como posso economizar mais?',
    'Qual o progresso dos meus investimentos?',
  ];

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  const handleNewConversation = async () => {
    // Clear session on server if we have one
    if (sessionId) {
      try {
        await fetch('/api/advisor/chat', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch (error) {
        console.error('Error clearing session:', error);
      }
    }

    // Clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }

    // Reset local state
    setSessionId(null);
    setMessages([WELCOME_MESSAGE]);
    setInput('');
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-success/10 text-success border-success/20';
      case 'medium':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-info/10 text-info border-info/20';
    }
  };

  const getConfidenceLabel = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'Alta confianca';
      case 'medium':
        return 'Media confianca';
      default:
        return 'Baixa confianca';
    }
  };

  return (
    <div className={`flex flex-col max-w-full overflow-x-hidden ${inDialog ? 'h-full overflow-hidden scrollbar-hide' : 'min-h-[600px] h-[calc(100vh-10rem)]'}`}>
      {!inDialog && (
        <div className="mb-4 sm:mb-6 max-w-full">
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold">AI Advisor</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Insights e recomendações personalizadas</p>
        </div>
      )}

      <div className={`grid grid-cols-1 ${inDialog ? 'lg:grid-cols-3 scrollbar-hide' : 'md:grid-cols-3 lg:grid-cols-3'} gap-3 sm:gap-4 md:gap-6 flex-1 min-h-0 overflow-hidden max-w-full`}>
        {/* Chat */}
        <div className={`${inDialog ? 'lg:col-span-2' : 'md:col-span-2 lg:col-span-2'} glass-card p-3 sm:p-4 md:p-6 flex flex-col min-h-0 overflow-hidden max-w-full min-w-0`}>
          <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <i className='bx bx-sparkles text-xl sm:text-2xl text-secondary flex-shrink-0'></i>
              <h2 className="font-display font-semibold text-base sm:text-lg truncate">Chat com Advisor</h2>
            </div>
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewConversation}
                className="text-muted-foreground hover:text-foreground flex-shrink-0 text-xs sm:text-sm"
                disabled={loading}
              >
                <i className='bx bx-repeat mr-1'></i>
                <span className="hidden sm:inline">Nova conversa</span>
                <span className="sm:hidden">Nova</span>
              </Button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0 pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`${msg.role === 'user' ? 'ml-auto max-w-[85%] sm:max-w-[80%]' : 'mr-auto max-w-[95%] sm:max-w-[90%]'}`}
              >
                <div
                  className={`p-3 sm:p-4 rounded-xl ${msg.role === 'user'
                    ? 'bg-gradient-to-r from-secondary to-primary text-white'
                    : 'bg-muted/30'
                    }`}
                >
                  <p className={`text-xs sm:text-sm mb-1 ${msg.role === 'user' ? 'text-white/80' : 'text-muted-foreground'}`}>
                    {msg.role === 'user' ? 'Você' : 'Advisor'}
                  </p>
                  <p className={`text-sm sm:text-base break-words ${msg.role === 'user' ? 'text-white' : 'text-foreground'}`}>
                    {msg.content}
                  </p>

                  {/* Insights */}
                  {msg.insights && msg.insights.length > 0 && (
                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Insights:</p>
                      <ul className="space-y-1">
                        {msg.insights.map((insight, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs sm:text-sm">
                            <i className={`bx ${insight.severity === 'high' ? 'bx-error-circle text-destructive' : insight.severity === 'medium' ? 'bx-error text-warning' : 'bx-sparkles text-secondary'} mt-0.5 flex-shrink-0`}></i>
                            <span className="break-words">{typeof insight === 'string' ? insight : insight.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Ações sugeridas:</p>
                      <div className="space-y-2">
                        {msg.actions.map((action, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-primary/5">
                            <i className='bx bx-right-arrow-alt text-secondary mt-0.5 flex-shrink-0'></i>
                            <span className="text-xs sm:text-sm break-words">{action.description || action.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidence */}
                  {msg.confidence && (
                    <div className="mt-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(msg.confidence)}`}>
                        {getConfidenceLabel(msg.confidence)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="mr-auto max-w-[90%]">
                <div className="p-4 rounded-xl bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-1">Advisor</p>
                  <div className="flex items-center gap-2">
                    <i className='bx bx-loader-alt bx-spin text-primary'></i>
                    <span>Analisando seus dados...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua pergunta..."
              disabled={loading}
              className="flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50 text-sm sm:text-base"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center flex-shrink-0 ${loading || !input.trim()
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:shadow-[0_0_10px_2px_hsl(280_44%_51%_/_0.3)] transition-all duration-300'
                }`}
              style={{
                background: 'linear-gradient(to right, #9448BC, #1FC0D2)', /* Amethyst -> Strong Cyan */
              }}
            >
              <i className='bx bx-send text-white text-base sm:text-lg'></i>
            </button>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-3 sm:space-y-4 md:space-y-6 max-w-full min-w-0 overflow-hidden scrollbar-hide">
          {/* Suggested Questions */}
          <div className="glass-card p-3 sm:p-4 md:p-6 max-w-full overflow-x-hidden">
            <h3 className="font-display font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Perguntas Sugeridas</h3>
            <div className="space-y-2 max-w-full">
              {suggestedQuestions.map((question, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedQuestion(question)}
                  className="w-full text-left p-2.5 sm:p-3 rounded-xl bg-muted/30 hover:bg-gradient-to-r hover:from-secondary/20 hover:to-primary/20 transition-all text-xs sm:text-sm break-words max-w-full"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="glass-card p-3 sm:p-4 md:p-6 max-w-full overflow-x-hidden">
            <h3 className="font-display font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Dicas</h3>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <i className='bx bx-info-circle text-secondary mt-0.5 flex-shrink-0'></i>
                <span className="break-words">O Advisor analisa suas transações para dar insights personalizados</span>
              </li>
              <li className="flex items-start gap-2">
                <i className='bx bx-info-circle text-secondary mt-0.5 flex-shrink-0'></i>
                <span className="break-words">Quanto mais dados você tiver, melhores serão as recomendações</span>
              </li>
              <li className="flex items-start gap-2">
                <i className='bx bx-info-circle text-secondary mt-0.5 flex-shrink-0'></i>
                <span className="break-words">Pergunte sobre orçamentos, economia e planejamento financeiro</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}