"use client";
import React, { useRef } from "react";
import { useScroll, useTransform, motion } from "framer-motion";
import Link from "next/link";

const Hero = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Animation transforms - faster rotation and expansion on scroll
  const rotate = useTransform(scrollYProgress, [0, 0.25], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.4], [1, 1.15]);
  const translateY = useTransform(scrollYProgress, [0, 0.3], [80, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [0.7, 1]);

  return (
    <section 
      ref={containerRef}
      className="min-h-[150vh] pt-16 md:pt-24 pb-8 md:pb-12 relative overflow-hidden"
    >
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[120px]" />
      </div>

      <div className="container-custom relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="fade-in-up stagger-1 mb-6">
            <span className="badge-pill">
              <i className='bx bx-sparkles'></i>
              Converse com suas finanças
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="fade-in-up stagger-2 font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            Controle suas Finanças com um{' '}
            <span className="gradient-text">Advisor de IA</span>
          </h1>

          {/* Subtitle */}
          <p className="fade-in-up stagger-3 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 text-balance">
            Transações, orçamentos, projeções e insights acionáveis — tudo em um painel simples.
            Utilize o <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 ml-1.5">
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              WhatsApp
            </span> para inserir novas compras e fazer consultas.
          </p>

          {/* CTA Button */}
          <div className="fade-in-up stagger-4 mb-8 md:mb-12">
            <Link href="/signup" className="btn-primary inline-flex items-center gap-2">
              <i className='bx bx-rocket'></i>
              Começar grátis
            </Link>
          </div>

          {/* Animated Frame */}
          <div 
            className="w-full max-w-5xl mx-auto mb-4 md:mb-8"
            style={{ perspective: "1000px" }}
          >
            <motion.div
              style={{
                rotateX: rotate,
                scale,
                y: translateY,
                opacity,
              }}
              className="w-full aspect-video border-4 border-primary/30 bg-card rounded-[30px] shadow-2xl overflow-hidden relative min-h-[400px] md:min-h-[500px]"
            >
              {/* YouTube Video - autoplay, loop, no UI, high quality */}
              <iframe
                className="w-full h-full absolute inset-0"
                src="https://www.youtube-nocookie.com/embed/zxjHLiZcqtY?autoplay=1&mute=1&loop=1&playlist=zxjHLiZcqtY&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&playsinline=1&start=1&enablejsapi=1&origin=https://c2finance.com.br"
                title="c2Finance Demo"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen={false}
                frameBorder="0"
                loading="eager"
                style={{ pointerEvents: 'none' }}
              />
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;
