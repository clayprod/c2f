'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

// Conversa fictícia para o chat web
const chatMessages = [
  { role: 'assistant', content: 'Olá! Sou seu AI Advisor. Como posso ajudar?' },
  { role: 'user', content: 'Como estão meus gastos este mês?' },
  { role: 'assistant', content: 'Você gastou R$ 3.450 este mês. Alimentação representa 35% dos gastos, acima do orçamento de R$ 800.' },
  { role: 'user', content: 'O que posso fazer para economizar?' },
  { role: 'assistant', content: 'Sugiro reduzir delivery em 20% e usar o cartão com cashback em supermercados. Economia estimada: R$ 280/mês.' },
];


const AIShowcase = () => {
  const [visibleMessages, setVisibleMessages] = useState<number>(0);
  const [isTyping, setIsTyping] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll para o final quando novas mensagens aparecem
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [visibleMessages, isTyping]);

  // Animação do chat - mostra mensagens uma por uma
  useEffect(() => {
    if (visibleMessages >= chatMessages.length) {
      // Reinicia após 3 segundos
      const resetTimer = setTimeout(() => {
        setVisibleMessages(0);
      }, 4000);
      return () => clearTimeout(resetTimer);
    }

    // Mostra "digitando" antes de cada mensagem do assistant
    const nextMessage = chatMessages[visibleMessages];
    if (nextMessage?.role === 'assistant' && visibleMessages > 0) {
      setIsTyping(true);
      const typingTimer = setTimeout(() => {
        setIsTyping(false);
        setVisibleMessages(prev => prev + 1);
      }, 1500);
      return () => clearTimeout(typingTimer);
    }

    // Delay entre mensagens
    const timer = setTimeout(() => {
      setVisibleMessages(prev => prev + 1);
    }, visibleMessages === 0 ? 500 : 2000);

    return () => clearTimeout(timer);
  }, [visibleMessages]);

  return (
    <section id="ai-advisor" className="section-padding bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
      </div>

      <div className="container-custom relative z-10">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <span className="badge-pill mb-4">
            <i className='bx bx-sparkles'></i>
            AI Advisor
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Seu consultor financeiro <span className="gradient-text">inteligente</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Converse pelo navegador ou WhatsApp. Registre gastos por texto ou áudio e receba insights personalizados.
          </p>
        </div>

        {/* Main Content - Chat + Phone + Features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-12">
          
          {/* Left: Chat Simulation */}
          <div className="order-2 lg:order-1">
            <div className="glass-card p-4 md:p-6 max-w-md mx-auto lg:mx-0">
              {/* Chat Header */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-secondary to-primary flex items-center justify-center">
                  <i className='bx bx-sparkles text-white text-lg'></i>
                </div>
                <div>
                  <h3 className="font-semibold text-sm">AI Advisor</h3>
                  <p className="text-xs text-muted-foreground">Online</p>
                </div>
                <div className="ml-auto flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                </div>
              </div>

              {/* Chat Messages */}
              <div ref={messagesContainerRef} className="space-y-3 min-h-[320px] max-h-[320px] overflow-y-auto scrollbar-hide">
                <AnimatePresence mode="popLayout">
                  {chatMessages.slice(0, visibleMessages).map((msg, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-r from-secondary to-primary text-white rounded-br-md'
                            : 'bg-muted/50 text-foreground rounded-bl-md'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Typing Indicator */}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-muted/50 p-3 rounded-2xl rounded-bl-md">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </motion.div>
                )}
                </div>

              {/* Chat Input (decorative) */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex gap-2 items-center">
                  <div className="flex-1 px-4 py-2.5 rounded-full bg-muted/30 border border-border text-sm text-muted-foreground">
                    Digite sua pergunta...
                  </div>
                  <button className="w-10 h-10 rounded-full bg-gradient-to-r from-secondary to-primary flex items-center justify-center">
                    <i className='bx bx-send text-white'></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Smartphone with WhatsApp */}
          <div className="order-1 lg:order-2 flex justify-center">
            <div className="relative">
              {/* Phone Frame */}
              <div className="relative w-[280px] md:w-[320px] bg-zinc-900 rounded-[45px] p-3 shadow-2xl">
                {/* Dynamic Island */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-10"></div>
                
                {/* Screen */}
                <div className="relative rounded-[35px] overflow-hidden bg-black">
                  <Image
                    src="/assets/whatsapp-advisor-demo.png"
                    alt="WhatsApp com AI Advisor"
                    width={320}
                    height={693}
                    className="w-full h-auto"
                    priority
                  />
                </div>
                
                {/* Home Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-zinc-600 rounded-full"></div>
              </div>

              {/* Floating Badge */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-background border border-border rounded-full px-4 py-2 shadow-lg">
                <div className="flex items-center gap-2 text-sm">
                  <svg 
                    className="w-5 h-5 text-[#25D366]" 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span className="font-medium">Fale pelo WhatsApp</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Text */}
        <div className="glass-card p-6 md:p-8 max-w-4xl mx-auto text-center">
          <h3 className="font-display text-xl md:text-2xl font-bold mb-4">
            Não precisa mudar sua rotina
          </h3>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
            Registre suas transações por <span className="text-foreground font-medium">texto ou áudio</span> diretamente pelo WhatsApp, 
            sem precisar abrir o aplicativo. Nossa <span className="text-foreground font-medium">IA analisa seu contexto financeiro</span> e 
            histórico para oferecer <span className="text-foreground font-medium">insights acionáveis</span> e recomendações práticas 
            baseadas nos seus dados. <span className="text-foreground font-medium">Disponível 24 horas por dia</span>, consulte a qualquer 
            momento, de qualquer lugar — com <span className="text-foreground font-medium">total privacidade</span>, seus dados 
            criptografados e em conformidade com a LGPD.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AIShowcase;
