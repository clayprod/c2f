import TopBanner from '@/components/landing/TopBanner';
import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import Metrics from '@/components/landing/Metrics';
import LogoCloud from '@/components/landing/LogoCloud';
import Evolution from '@/components/landing/Evolution';
import Features from '@/components/landing/Features';
import Demo from '@/components/landing/Demo';
import Integrations from '@/components/landing/Integrations';
import Pricing from '@/components/landing/Pricing';
import FAQ from '@/components/landing/FAQ';
import CTA from '@/components/landing/CTA';
import Footer from '@/components/landing/Footer';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBanner />
      <Navbar />
      <main>
        <Hero />
        <Metrics />
        <LogoCloud />
        <Evolution />
        <Features />
        <Demo />
        <Integrations />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
