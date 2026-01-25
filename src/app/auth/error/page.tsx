'use client';

import Link from 'next/link';
import { useLogo } from '@/hooks/useLogo';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const message = searchParams?.get('message') || 'Ocorreu um erro durante a autenticação.';

  return (
    <div className="glass-card p-8">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <i className="bx bx-error-circle text-5xl text-destructive" />
        </div>
        
        <div>
          <h1 className="font-display text-2xl font-bold mb-2">Ops! Algo deu errado</h1>
          <p className="text-muted-foreground text-sm">
            {message}
          </p>
        </div>

        <div className="pt-4 space-y-3">
          <Link href="/login" className="btn-primary w-full inline-block text-center">
            Voltar para o login
          </Link>
          <Link 
            href="/forgot-password" 
            className="block w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Esqueceu sua senha?
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorFallback() {
  return (
    <div className="glass-card p-8">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center animate-pulse">
          <i className="bx bx-loader-alt text-5xl text-muted-foreground animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm mt-4">Carregando...</p>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  const logo = useLogo();
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link href="/" className="flex items-center justify-center mb-8">
          <Image
            src={logo}
            alt="c2Finance"
            width={120}
            height={40}
            className="h-8 md:h-10 w-auto"
            style={{ objectFit: 'contain' }}
            priority
          />
        </Link>

        <Suspense fallback={<ErrorFallback />}>
          <ErrorContent />
        </Suspense>
      </div>
    </div>
  );
}
