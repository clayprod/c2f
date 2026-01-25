'use client';

import Link from 'next/link';
import { useLogo } from '@/hooks/useLogo';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EmailConfirmedPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  const logo = useLogo();

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/app');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

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
            <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
              <i className="bx bx-check-circle text-5xl text-green-500" />
            </div>
            
            <div>
              <h1 className="font-display text-2xl font-bold mb-2">Email confirmado!</h1>
              <p className="text-muted-foreground text-sm">
                Sua conta foi verificada com sucesso. Agora você pode acessar todas as funcionalidades.
              </p>
            </div>

            <div className="pt-4 space-y-3">
              <Link href="/app" className="btn-primary w-full inline-block text-center">
                Acessar minha conta
              </Link>
              <p className="text-xs text-muted-foreground">
                Redirecionando automaticamente em {countdown}s...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
