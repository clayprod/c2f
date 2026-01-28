'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { useLogo } from '@/hooks/useLogo';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Turnstile } from '@/components/auth/Turnstile';

function LoginForm() {
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams?.get('email') || '';
  const [email, setEmail] = useState(emailFromQuery);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lockoutStatus, setLockoutStatus] = useState<{
    locked: boolean;
    attemptsRemaining: number;
    requiresCaptcha: boolean;
  } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const router = useRouter();
  const next = searchParams?.get('next') || '/app';
  const { toast } = useToast();

  // Check for OAuth errors
  const oauthError = searchParams?.get('error');
  const oauthErrorDescription = searchParams?.get('error_description');
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const inviteFromQuery = useMemo(
    () => searchParams?.get('invite') || searchParams?.get('token') || '',
    [searchParams]
  );
  const pendingInviteToken = useMemo(() => {
    if (inviteFromQuery) return inviteFromQuery;
    try {
      return localStorage.getItem('c2f_pending_invite_token') || '';
    } catch {
      return '';
    }
  }, [inviteFromQuery]);

  // Show OAuth error toast if present
  useEffect(() => {
    if (oauthError) {
      toast({
        variant: "destructive",
        title: "Erro na autenticação",
        description: oauthErrorDescription || `Ocorreu um erro ao fazer login: ${oauthError}`,
      });
    }
  }, [oauthError, oauthErrorDescription, toast]);

  // Verificar status de bloqueio quando email mudar
  useEffect(() => {
    const checkLockout = async () => {
      if (!email || email.length < 3) {
        setLockoutStatus(null);
        setTurnstileToken(null);
        return;
      }

      try {
        const response = await fetch('/api/auth/check-lockout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        if (response.ok) {
          const data = await response.json();
          setLockoutStatus(data);
          if (!data.requiresCaptcha) {
            setTurnstileToken(null);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar bloqueio:', error);
      }
    };

    const timeoutId = setTimeout(checkLockout, 500);
    return () => clearTimeout(timeoutId);
  }, [email]);

  useEffect(() => {
    if (!inviteFromQuery) return;
    try {
      localStorage.setItem('c2f_pending_invite_token', inviteFromQuery);
    } catch {
      // ignore
    }
  }, [inviteFromQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verificar se está bloqueado e requer captcha
    if (lockoutStatus?.locked && lockoutStatus.requiresCaptcha && !turnstileToken) {
      toast({
        variant: "destructive",
        title: "Verificação necessária",
        description: "Por favor, complete a verificação 'Sou humano' antes de continuar.",
      });
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Registrar tentativa falhada
        try {
          const attemptResponse = await fetch('/api/auth/login-attempt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, success: false }),
          });

          if (attemptResponse.ok) {
            const attemptData = await attemptResponse.json();
            setLockoutStatus({
              locked: attemptData.locked,
              attemptsRemaining: attemptData.attemptsRemaining,
              requiresCaptcha: attemptData.requiresCaptcha,
            });

            if (attemptData.passwordResetSent) {
              setPasswordResetSent(true);
            }
          }
        } catch (attemptError) {
          console.error('Erro ao registrar tentativa:', attemptError);
        }

        throw error;
      }

      // Registrar tentativa bem-sucedida
      try {
        await fetch('/api/auth/login-attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, success: true }),
        });
      } catch (attemptError) {
        console.error('Erro ao registrar tentativa:', attemptError);
      }

      if (pendingInviteToken) {
        try {
          localStorage.removeItem('c2f_pending_invite_token');
        } catch {
          // ignore
        }
        router.push(`/app/sharing/accept?token=${encodeURIComponent(pendingInviteToken)}`);
      } else {
        router.push(next);
      }
      router.refresh();
    } catch (error: any) {
      // Traduzir mensagens de erro comuns do Supabase
      let errorMessage = "Credenciais inválidas. Verifique seu email e senha.";
      
      if (error.message) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('invalid login credentials') || errorMsg.includes('email not confirmed')) {
          errorMessage = "Credenciais inválidas. Verifique seu email e senha.";
        } else if (errorMsg.includes('email not confirmed')) {
          errorMessage = "Email não confirmado. Verifique sua caixa de entrada.";
        } else if (errorMsg.includes('too many requests')) {
          errorMessage = "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.";
        } else if (errorMsg.includes('user not found')) {
          errorMessage = "Usuário não encontrado. Verifique seu email.";
        } else if (errorMsg.includes('incorrect password')) {
          errorMessage = "Senha incorreta. Verifique sua senha ou use 'Esqueceu a senha?'.";
        } else {
          // Para outros erros, usar mensagem genérica em português
          errorMessage = "Não foi possível fazer login. Tente novamente.";
        }
      }

      toast({
        variant: "destructive",
        title: "Falha na autenticação",
        description: errorMessage,
      });
      setTurnstileToken(null); // Reset captcha token on error
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const supabase = createClient();

      // Use a origem atual para o redirecionamento
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao fazer login com Google",
        description: error.message || "Não foi possível fazer login com Google. Tente novamente.",
      });
    }
  };

  return (
    <div className="glass-card p-8">
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold mb-2">Bem-vindo de volta</h1>
        <p className="text-muted-foreground text-sm">Entre na sua conta para continuar</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            placeholder="seu@email.com"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            Senha
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              placeholder="••••••••"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox id="remember" />
            <span className="text-muted-foreground">Lembrar de mim</span>
          </label>
          <Link href="/forgot-password" className="text-primary hover:underline">
            Esqueceu a senha?
          </Link>
        </div>

        {lockoutStatus && lockoutStatus.attemptsRemaining < 3 && (
          <div className="text-sm text-muted-foreground text-center">
            {lockoutStatus.locked ? (
              <p className="text-destructive">
                Conta temporariamente bloqueada. Verifique seu email para redefinir a senha.
              </p>
            ) : (
              <p>
                Tentativas restantes: {lockoutStatus.attemptsRemaining} de 3
              </p>
            )}
          </div>
        )}

        {passwordResetSent && (
          <div className="p-3 rounded-lg bg-primary/10 text-primary text-sm text-center">
            Email de redefinição de senha enviado! Verifique sua caixa de entrada.
          </div>
        )}

        {lockoutStatus?.requiresCaptcha && turnstileSiteKey && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              Por segurança, confirme que você é humano:
            </p>
            <Turnstile
              siteKey={turnstileSiteKey}
              onVerify={(token) => {
                setTurnstileToken(token);
              }}
              onError={() => {
                setTurnstileToken(null);
                toast({
                  variant: "destructive",
                  title: "Erro na verificação",
                  description: "Não foi possível verificar. Tente novamente.",
                });
              }}
              onExpire={() => {
                setTurnstileToken(null);
              }}
            />
          </div>
        )}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading || (lockoutStatus?.requiresCaptcha && !turnstileToken)}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou continue com</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-muted/50 border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="text-sm font-medium">Continuar com Google</span>
        </button>
      </div>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Não tem uma conta?{' '}
        <Link
          href={pendingInviteToken ? `/signup?invite=${encodeURIComponent(pendingInviteToken)}` : '/signup'}
          className="text-primary hover:underline font-medium"
        >
          Criar conta
        </Link>
      </div>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="glass-card p-8">
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold mb-2">Bem-vindo de volta</h1>
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
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

        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Ao entrar, você concorda com nossos{' '}
          <Link
            href="/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Termos de Uso
          </Link>{' '}
          e{' '}
          <Link
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Política de Privacidade
          </Link>
        </p>
      </div>
    </div>
  );
}
