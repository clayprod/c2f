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

export default function HomePage() {
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






