'use client';

import Image from 'next/image';

const testimonials = [
  {
    name: 'Marina de Souza',
    role: 'Empreendedora',
    company: 'TechStart Ltda',
    image: '/assets/testimonials/marina-souza.jpg',
    text: 'O c2Finance transformou minha relação com o dinheiro. Antes eu não sabia onde meu dinheiro ia, agora tenho controle total. O AI Advisor me ajuda a tomar decisões muito mais inteligentes.',
    rating: 5,
  },
  {
    name: 'João Pedro',
    role: 'Freelancer',
    company: 'Designer Independente',
    image: '/assets/testimonials/joao-pedro.jpg',
    text: 'Como freelancer, preciso gerenciar várias fontes de renda. O c2Finance organizou tudo de forma incrível. As projeções me ajudam a planejar os meses e eu nunca mais perdi um prazo de pagamento.',
    rating: 5,
  },
  {
    name: 'Ana Costa',
    role: 'Gerente Financeira',
    company: 'StartupXYZ',
    image: '/assets/testimonials/ana-costa.jpg',
    text: 'Finalmente consegui organizar minhas finanças pessoais! O c2Finance me ajudou a entender para onde estava indo meu dinheiro e a criar uma reserva de emergência. A parte dos orçamentos automáticos é incrível, não preciso mais ficar anotando tudo manualmente.',
    rating: 5,
  },
];

const Metrics = () => {
  // SEÇÃO DE DEPOIMENTOS TEMPORARIAMENTE DESABILITADA
  // Para reativar, descomente o bloco abaixo e remova o return null
  return null;

  /* INÍCIO DA SEÇÃO DE DEPOIMENTOS - COMENTADA
  return (
    <section id="testimonials" className="section-padding pt-10 md:pt-12 bg-muted/20 relative overflow-hidden">
      {/* Background Effects *}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-[120px]" />
      </div>

      <div className="container-custom relative z-10">
        <div className="text-center mb-16">
          <span className="badge-pill mb-4">
            <i className='bx bx-star'></i>
            Depoimentos
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            O que nossos clientes <span className="gradient-text">falam</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Veja como o c2Finance está transformando a vida financeira de pessoas e empresas
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="glass-card-hover p-8 group relative flex flex-col"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Rating Stars *}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <i key={i} className='bx bxs-star text-primary text-lg'></i>
                ))}
              </div>

              {/* Testimonial Text *}
              <p className="text-muted-foreground mb-6 leading-relaxed text-sm flex-1">
                "{testimonial.text}"
              </p>

              {/* Author Info *}
              <div className="flex items-center gap-4 pt-6 border-t border-border mt-auto">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback para placeholder se imagem não existir
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-sm">{testimonial.name}</div>
                  <div className="text-muted-foreground text-xs truncate">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
  FIM DA SEÇÃO DE DEPOIMENTOS */
};

export default Metrics;
