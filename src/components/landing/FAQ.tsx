'use client';

import { useState } from 'react';

const faqs = [
  {
    question: 'A IA acessa meus dados bancários?',
    answer:
      'A IA processa apenas os dados que você importa ou conecta voluntariamente. Não temos acesso direto às suas contas bancárias. Quando você usa a integração Open Finance, os dados são criptografados e você pode desconectar a qualquer momento.',
  },
  {
    question: 'Preciso conectar bancos?',
    answer:
      'Não! A conexão bancária é totalmente opcional. Você pode usar o c2Finance importando seus extratos manualmente via CSV ou OFX. A integração bancária é apenas uma facilidade adicional.',
  },
  {
    question: 'Como funciona a cobrança?',
    answer:
      'Usamos o Stripe para processar pagamentos. A cobrança é mensal e você pode cancelar a qualquer momento. No plano gratuito, não é necessário cartão de crédito.',
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer:
      'Sim! Você pode cancelar sua assinatura a qualquer momento, sem multa ou burocracia. Seu acesso continua até o final do período pago.',
  },
  {
    question: 'Quais formatos de importação são aceitos?',
    answer:
      'Aceitamos CSV (Excel/Planilhas) e OFX (formato bancário padrão). A maioria dos bancos brasileiros permite exportar extratos nesses formatos.',
  },
  {
    question: "O que é considerado 'uso do Advisor'?",
    answer:
      'Cada pergunta ou solicitação de análise feita ao AI Advisor conta como um uso. O acesso depende do plano contratado e pode variar conforme a configuração.',
  },
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="section-padding bg-muted/20">
      <div className="container-custom">
        <div className="text-center mb-16">
          <span className="badge-pill mb-4">
            <i className='bx bx-help-circle'></i>
            FAQ
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Perguntas <span className="gradient-text">frequentes</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Tire suas dúvidas sobre o c2Finance
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="glass-card overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/20 transition-colors"
              >
                <span className="font-display font-medium pr-4">{faq.question}</span>
                <i
                  className={`bx bx-chevron-down text-2xl text-muted-foreground transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                ></i>
              </button>
              {openIndex === index && (
                <div className="py-4 px-6 animate-fade-in">
                  <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
