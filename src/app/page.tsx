'use client';

export const dynamic = 'force-dynamic';

import TopBanner from '@/components/landing/TopBanner';
import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import AIShowcase from '@/components/landing/AIShowcase';
import Metrics from '@/components/landing/Metrics';
import Features from '@/components/landing/Features';
import BankLogosCarousel from '@/components/landing/BankLogosCarousel';
import Pricing from '@/components/landing/Pricing';
import FAQ from '@/components/landing/FAQ';
import CTA from '@/components/landing/CTA';
import Footer from '@/components/landing/Footer';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      // 1. Resgate: Se cairmos na home com um código do Google/Supabase
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        const next = params.get('next') || '/app';
        router.push(`/auth/callback?code=${code}&next=${encodeURIComponent(next)}`);
        return;
      }

      // 2. Verificação normal de sessão
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/app');
      }
    };
    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <TopBanner />
      <Navbar />
      <main>
        <Hero />
        <AIShowcase />
        <Features />
        <BankLogosCarousel />
        <Metrics />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}






