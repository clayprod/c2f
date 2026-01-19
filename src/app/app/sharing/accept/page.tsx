'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type InvitePreview = {
  id: string;
  email: string;
  role: string;
  permissions: Record<string, unknown>;
  status: string;
  expires_at: string;
  owner_id: string;
  profiles?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
};

export default function AcceptSharingInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const token = useMemo(() => searchParams?.get('token') || '', [searchParams]);

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvite() {
      if (!token) {
        setError('Token inválido.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/sharing/accept?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Não foi possível carregar o convite.');
        }

        setInvite(data.data as InvitePreview);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    loadInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    try {
      setAccepting(true);
      const res = await fetch('/api/sharing/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível aceitar o convite.');
      }

      toast({
        title: 'Convite aceito',
        description: 'Sua conta agora tem acesso ao compartilhamento.',
      });

      router.push('/app');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido.';
      toast({
        variant: 'destructive',
        title: 'Falha ao aceitar convite',
        description: msg,
      });
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="font-display text-xl md:text-2xl lg:text-3xl font-bold">Aceitar convite</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Confirme o convite para acessar uma conta compartilhada.
        </p>
      </div>

      <div className="glass-card p-4 md:p-6 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <i className="bx bx-loader-alt bx-spin" />
            Carregando convite...
          </div>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-destructive font-medium">{error}</p>
            <Button variant="outline" onClick={() => router.push('/app')}>
              Voltar
            </Button>
          </div>
        ) : invite ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {invite.profiles?.avatar_url ? (
                <img
                  src={invite.profiles.avatar_url}
                  alt={invite.profiles.full_name || 'Avatar'}
                  className="w-12 h-12 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <i className="bx bx-user" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {invite.profiles?.full_name || invite.profiles?.email || 'Conta'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {invite.profiles?.email || ''}
                </p>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>
                Ao aceitar, você terá acesso conforme as permissões definidas pelo convidador.
              </p>
              <p className="mt-1">
                Dica: depois de aceitar, use o seletor de conta (no topo do app) para alternar entre sua conta e a conta compartilhada.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => router.push('/app')} disabled={accepting}>
                Cancelar
              </Button>
              <Button onClick={handleAccept} disabled={accepting}>
                {accepting ? 'Aceitando...' : 'Aceitar convite'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">Convite não encontrado.</div>
        )}
      </div>
    </div>
  );
}

