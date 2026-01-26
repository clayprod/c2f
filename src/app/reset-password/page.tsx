'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLogo } from '@/hooks/useLogo';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Verificar se há uma sessão válida de recuperação
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      
      // Verificar se há hash na URL (Supabase redireciona com fragment)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      
      if (accessToken && refreshToken && type === 'recovery') {
        // Definir a sessão manualmente
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (sessionError) {
          setError('Link de recuperação inválido ou expirado. Solicite um novo link.');
          setIsValidSession(false);
          return;
        }
        
        setIsValidSession(true);
        return;
      }
      
      // Verificar sessão existente
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsValidSession(true);
      } else {
        setError('Link de recuperação inválido ou expirado. Solicite um novo link.');
        setIsValidSession(false);
      }
    };
    
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Senhas não conferem",
        description: "As senhas digitadas não são iguais.",
      });
      return;
    }
    
    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres.",
      });
      return;
    }
    
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setSuccess(true);
      toast({
        title: "Senha atualizada!",
        description: "Sua senha foi redefinida com sucesso.",
      });
      
      // Redirecionar para o app após 2 segundos
      setTimeout(() => {
        router.push('/app');
      }, 2000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar senha",
        description: error.message || "Não foi possível atualizar sua senha. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregando...
  if (isValidSession === null) {
    return (
      <div className="glass-card p-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center animate-pulse">
            <i className="bx bx-loader-alt text-3xl text-muted-foreground animate-spin" />
          </div>
          <p className="text-muted-foreground text-sm mt-4">Verificando link...</p>
        </div>
      </div>
    );
  }

  // Link inválido
  if (!isValidSession) {
    return (
      <div className="glass-card p-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <i className="bx bx-error text-3xl text-destructive" />
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-2">Link inválido</h2>
            <p className="text-muted-foreground text-sm">
              {error || 'Este link de recuperação é inválido ou expirou.'}
            </p>
          </div>
          <div className="pt-4">
            <Link
              href="/forgot-password"
              className="btn-primary inline-block"
            >
              Solicitar novo link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Sucesso
  if (success) {
    return (
      <div className="glass-card p-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
            <i className="bx bx-check text-3xl text-success" />
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-2">Senha atualizada!</h2>
            <p className="text-muted-foreground text-sm">
              Sua senha foi redefinida com sucesso. Você será redirecionado...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Formulário de redefinição
  return (
    <div className="glass-card p-8">
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold mb-2">Redefinir senha</h1>
        <p className="text-muted-foreground text-sm">
          Digite sua nova senha abaixo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            Nova senha
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
              minLength={6}
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

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
            Confirmar nova senha
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              placeholder="••••••••"
              required
              minLength={6}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showConfirmPassword ? (
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

        <button 
          type="submit" 
          className="btn-primary w-full" 
          disabled={loading}
        >
          {loading ? 'Atualizando...' : 'Atualizar senha'}
        </button>
      </form>
    </div>
  );
}

function ResetPasswordFallback() {
  return (
    <div className="glass-card p-8">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center animate-pulse">
          <i className="bx bx-loader-alt text-3xl text-muted-foreground animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm mt-4">Carregando...</p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
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

        <Suspense fallback={<ResetPasswordFallback />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
