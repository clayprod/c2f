import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Providers } from './providers';
import CookieBanner from '@/components/landing/CookieBanner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'c2Finance - Controle Financeiro Inteligente',
  description: 'SaaS de finanças pessoais/empresariais com AI Advisor',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
    other: [
      { rel: 'android-chrome-192x192', url: '/android-chrome-192x192.png' },
      { rel: 'android-chrome-512x512', url: '/android-chrome-512x512.png' },
    ],
  },
};

// Script inline para aplicar tema ANTES do render (evita FOUC)
const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem('c2f-theme');
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable} overflow-x-hidden`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="stylesheet" href="/boxicons.min.css" />
        <link rel="stylesheet" href="/boxicons-brands.min.css" />
      </head>
      <body className="overflow-x-hidden">
        <Providers>
          {children}
          <Toaster />
          <Sonner />
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}
