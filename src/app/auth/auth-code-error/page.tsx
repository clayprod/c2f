'use client';

import Link from 'next/link';
import { useLogo } from '@/hooks/useLogo';
import Image from 'next/image';

export default function AuthCodeErrorPage() {
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

        <div className="glass-card p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h1 className="font-display text-2xl font-bold mb-2">Erro na Autenticação</h1>
            <p className="text-muted-foreground mb-6">
              Ocorreu um erro ao processar sua autenticação. Por favor, tente novamente.
            </p>
          </div>

          <div className="space-y-3">
            <Link href="/login" className="btn-primary w-full inline-block text-center">
              Tentar Novamente
            </Link>
            
            <Link href="/" className="btn-secondary w-full inline-block text-center">
              Voltar para Página Inicial
            </Link>
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Se o problema persistir:</strong>
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1 text-left">
              <li>• Verifique se você permitiu o acesso na tela do Google</li>
              <li>• Tente limpar os cookies do navegador</li>
              <li>• Use uma aba anônima do navegador</li>
              <li>• Entre em contato com o suporte</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}