'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'c2finance-cookie-consent';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Verificar se o usuário já deu consentimento
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Mostrar banner após um pequeno delay para não atrapalhar a renderização inicial
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setShowBanner(false);
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected');
    setShowBanner(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg animate-in slide-in-from-bottom duration-300">
      <div className="container-custom py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <i className='bx bx-cookie text-xl text-primary'></i>
              <h3 className="font-semibold text-sm">Política de Cookies</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Utilizamos cookies para melhorar sua experiência, analisar o uso do site e personalizar conteúdo. 
              Ao continuar navegando, você concorda com nossa{' '}
              <Link href="/privacy-policy" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              className="text-xs"
            >
              Rejeitar
            </Button>
            <Button
              onClick={handleAccept}
              size="sm"
              className="btn-primary text-xs"
            >
              Aceitar
            </Button>
            <button
              onClick={handleReject}
              className="p-1 hover:bg-muted rounded-md transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


