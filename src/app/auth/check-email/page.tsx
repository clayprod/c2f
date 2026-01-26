'use client';

import Link from 'next/link';
import { useLogo } from '@/hooks/useLogo';
import Image from 'next/image';

export default function CheckEmailPage() {
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

        <div className="glass-card p-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <i className="bx bx-envelope text-5xl text-primary" />
            </div>

            <div>
              <h1 className="font-display text-2xl font-bold mb-2">Confirme seu email</h1>
              <p className="text-muted-foreground text-sm">
                Enviamos um link de confirmacao para seu email. Clique nele para ativar sua conta.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-left text-xs text-muted-foreground">
              <p>Verifique a caixa de entrada e a pasta de spam.</p>
              <p>Se nao encontrar, aguarde alguns minutos antes de tentar novamente.</p>
            </div>

            <div className="pt-4 space-y-3">
              <Link href="/login" className="btn-primary w-full inline-block text-center">
                Ir para o login
              </Link>
              <p className="text-xs text-muted-foreground">
                Depois de confirmar, voce ja pode entrar normalmente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
