'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  insights?: string[];
  actions?: {
    type: string;
    description: string;
    payload?: any;
  }[];
  confidence?: string;
}

interface AdvisorResponse {
  summary: string;
  insights: string[];
  actions: { type: string; description: string; payload?: any }[];
  confidence: string;
  citations: string[];
}

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Ola! Sou seu AI Advisor financeiro. Posso ajudar voce a entender seus gastos, criar orcamentos e tomar decisoes mais inteligentes com seu dinheiro. Como posso ajudar?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao processar mensagem');
      }

      const data: AdvisorResponse = await res.json();

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
        description: error.message || 'Nao foi possivel obter resposta do Advisor',
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
    'Como estao meus gastos este mes?',
    'Quais categorias estao acima do orcamento?',
    'Como posso economizar mais?',
    'Qual e minha situacao financeira atual?',
  ];

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
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
    <div className="space-y-6 h-[calc(100vh-10rem)]">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">AI Advisor</h1>
        <p className="text-muted-foreground">Insights e recomendacoes personalizadas</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 h-[calc(100%-4rem)]">
        {/* Chat */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4">
            <i className='bx bx-bot text-2xl text-primary'></i>
            <h2 className="font-display font-semibold text-lg">Chat com Advisor</h2>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`${msg.role === 'user' ? 'ml-auto max-w-[80%]' : 'mr-auto max-w-[90%]'}`}
              >
                <div
                  className={`p-4 rounded-xl ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/30'
                  }`}
                >
                  <p className="text-sm text-muted-foreground mb-1">
                    {msg.role === 'user' ? 'Voce' : 'Advisor'}
                  </p>
                  <p className="text-foreground">{msg.content}</p>

                  {/* Insights */}
                  {msg.insights && msg.insights.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Insights:</p>
                      <ul className="space-y-1">
                        {msg.insights.map((insight, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <i className='bx bx-bulb text-yellow-500 mt-0.5'></i>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Acoes sugeridas:</p>
                      <div className="space-y-2">
                        {msg.actions.map((action, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-primary/5">
                            <i className='bx bx-right-arrow-alt text-primary mt-0.5'></i>
                            <span className="text-sm">{action.description}</span>
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
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua pergunta..."
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50"
            />
            <Button type="submit" disabled={loading || !input.trim()} className="btn-primary px-6">
              <i className='bx bx-send'></i>
            </Button>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Suggested Questions */}
          <div className="glass-card p-6">
            <h3 className="font-display font-semibold mb-4">Perguntas Sugeridas</h3>
            <div className="space-y-2">
              {suggestedQuestions.map((question, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedQuestion(question)}
                  className="w-full text-left p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-sm"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="glass-card p-6">
            <h3 className="font-display font-semibold mb-4">Dicas</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <i className='bx bx-info-circle text-primary mt-0.5'></i>
                <span>O Advisor analisa suas transacoes para dar insights personalizados</span>
              </li>
              <li className="flex items-start gap-2">
                <i className='bx bx-info-circle text-primary mt-0.5'></i>
                <span>Quanto mais dados voce tiver, melhores serao as recomendacoes</span>
              </li>
              <li className="flex items-start gap-2">
                <i className='bx bx-info-circle text-primary mt-0.5'></i>
                <span>Pergunte sobre orcamentos, economia e planejamento financeiro</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
