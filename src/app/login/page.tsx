'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { getLogo } from '@/lib/logo';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') || '/app';
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push(next);
      router.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Falha na autenticação",
        description: error.message || "Credenciais inválidas. Verifique seu email e senha.",
      });
    } finally {
      setLoading(false);
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
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            placeholder="••••••••"
            required
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox id="remember" />
            <span className="text-muted-foreground">Lembrar de mim</span>
          </label>
          <a href="#" className="text-primary hover:underline">
            Esqueceu a senha?
          </a>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Não tem uma conta?{' '}
        <Link href="/signup" className="text-primary hover:underline font-medium">
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
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link href="/" className="flex items-center justify-center mb-8">
          <Image
            src={getLogo('auto')}
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
          <Link href="/terms-of-service" className="text-primary hover:underline">
            Termos de Uso
          </Link>{' '}
          e{' '}
          <Link href="/privacy-policy" className="text-primary hover:underline">
            Política de Privacidade
          </Link>
        </p>
      </div>
    </div>
  );
}
