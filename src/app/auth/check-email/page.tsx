'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLogo } from '@/hooks/useLogo';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

function CheckEmailPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const logo = useLogo();
  const { toast } = useToast();
  
  const emailFromUrl = searchParams?.get('email') || '';
  const [email, setEmail] = useState(emailFromUrl);
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [needsConfirmation, setNeedsConfirmation] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  // Verificar status de confirmação ao montar o componente
  useEffect(() => {
    const checkEmailStatus = async () => {
      if (!email) {
        setIsChecking(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/check-email-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        if (response.ok) {
          const data = await response.json();
          setNeedsConfirmation(data.needsConfirmation);
          if (!data.needsConfirmation) {
            // Email já confirmado, redirecionar após alguns segundos
            toast({
              title: 'Email já confirmado!',
              description: 'Redirecionando para o login...',
            });
            setTimeout(() => {
              router.push('/login');
            }, 3000);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status do email:', error);
        // Em caso de erro, assumir que precisa confirmação
        setNeedsConfirmation(true);
      } finally {
        setIsChecking(false);
      }
    };

    checkEmailStatus();
  }, [email, router, toast]);

  // Polling para verificar se email foi confirmado enquanto usuário está na página
  useEffect(() => {
    if (!email || !needsConfirmation) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/auth/check-email-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        if (response.ok) {
          const data = await response.json();
          if (!data.needsConfirmation) {
            // Email foi confirmado!
            setNeedsConfirmation(false);
            toast({
              title: 'Email confirmado!',
              description: 'Redirecionando para o login...',
            });
            setTimeout(() => {
              router.push('/login');
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status do email (polling):', error);
      }
    }, 5000); // Verificar a cada 5 segundos

    return () => clearInterval(interval);
  }, [email, needsConfirmation, router, toast]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleResendVerification = async () => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Email não encontrado',
        description: 'Por favor, faça o cadastro novamente.',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao reenviar email');
      }

      toast({
        title: 'Email reenviado!',
        description: 'Verifique sua caixa de entrada e spam.',
      });

      // Iniciar cooldown de 60 segundos
      setCooldownSeconds(60);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao reenviar email',
        description: error.message || 'Não foi possível reenviar o email. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  const displayEmail = email || 'seu email';

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

            {isChecking ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <i className="bx bx-loader-alt bx-spin" />
                  <span className="text-sm">Verificando...</span>
                </div>
              </div>
            ) : needsConfirmation ? (
              <>
                <div>
                  <h1 className="font-display text-2xl font-bold mb-2">Confirme seu email</h1>
                  <p className="text-muted-foreground text-sm">
                    Enviamos um link de confirmação para <strong>{displayEmail}</strong>. Clique nele para ativar sua conta.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-left text-xs text-muted-foreground">
                  <p>Verifique a caixa de entrada e a pasta de spam.</p>
                  <p>Se não encontrar, aguarde alguns minutos antes de tentar novamente.</p>
                </div>

                <div className="pt-4 space-y-3">
                  <button
                    onClick={handleResendVerification}
                    className="btn-secondary w-full inline-block text-center"
                    disabled={loading || cooldownSeconds > 0}
                  >
                    {loading ? 'Enviando...' : cooldownSeconds > 0 ? `Aguarde ${cooldownSeconds}s` : 'Enviar novamente'}
                  </button>
                  <Link href="/login" className="btn-primary w-full inline-block text-center">
                    Ir para o login
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Depois de confirmar, você já pode entrar normalmente.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h1 className="font-display text-2xl font-bold mb-2">Email confirmado!</h1>
                  <p className="text-muted-foreground text-sm">
                    Seu email foi confirmado com sucesso. Redirecionando para o login...
                  </p>
                </div>
                <div className="pt-4">
                  <Link href="/login" className="btn-primary w-full inline-block text-center">
                    Ir para o login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <i className="bx bx-loader-alt bx-spin" />
          Carregando...
        </div>
      </div>
    }>
      <CheckEmailPageContent />
    </Suspense>
  );
}
