'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

type DebugOwnerData = {
  userId: string;
  rawCookie: string | null;
  cookieOwnerId: string | null;
  effectiveOwnerId: string;
  isViewingSharedAccount: boolean;
  membershipFound: boolean;
  membership: any | null;
  membershipError: any | null;
  adminMembershipFound: boolean;
  adminMembership: any | null;
  adminMembershipError: any | null;
  canReadOwnerAccounts: boolean;
  accountsError: any | null;
  canReadOwnerTransactions: boolean;
  transactionsError: any | null;
  ownerAccountsCount: number;
  ownerTransactionsCount: number;
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className="text-sm">{label}</span>
    </div>
  );
}

function InfoCard({ title, value, highlight }: { title: string; value: string | null; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? 'bg-primary/5 border-primary' : 'bg-muted/30 border-border'}`}>
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <div className={`font-mono text-sm break-all ${highlight ? 'text-primary font-semibold' : ''}`}>
        {value || '(vazio)'}
      </div>
    </div>
  );
}

export default function SharingDebugPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DebugOwnerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const localActive = useMemo(() => {
    try {
      return localStorage.getItem('c2f_active_account');
    } catch {
      return null;
    }
  }, []);

  const cookieActive = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('c2f_active_account='));
    if (!match) return null;
    return decodeURIComponent(match.split('=')[1] || '');
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/sharing/debug-owner', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load debug data');
      setData(json.data as DebugOwnerData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isViewingSharedAccount = data && data.effectiveOwnerId !== data.userId;
  const cookieMatches = localActive === cookieActive;
  const cookieSyncIssue = localActive && !cookieActive;

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="font-display text-xl md:text-2xl lg:text-3xl font-bold">Debug compartilhamento</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Esta página mostra o que o servidor está vendo para resolver a conta ativa.
        </p>
      </div>

      {/* Client-side state */}
      <div className="glass-card p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Estado no cliente (browser)</h2>
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InfoCard title="localStorage c2f_active_account" value={localActive || null} />
          <InfoCard title="document.cookie c2f_active_account" value={cookieActive || null} />
        </div>

        {cookieSyncIssue && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Aviso:</strong> localStorage tem valor mas cookie não. Isso pode causar problemas ao recarregar a página.
              O servidor não consegue ler localStorage, apenas cookies.
            </div>
          </div>
        )}

        {!cookieMatches && localActive && cookieActive && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Aviso:</strong> localStorage e cookie têm valores diferentes. Isso pode causar inconsistências.
            </div>
          </div>
        )}
      </div>

      {/* Server-side state */}
      {error && (
        <div className="glass-card p-4 md:p-6">
          <div className="flex items-start gap-2 text-destructive">
            <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold">Erro ao carregar dados</div>
              <div className="text-sm mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {data && (
        <div className="glass-card p-4 md:p-6 space-y-4">
          <h2 className="font-semibold text-lg">Estado no servidor</h2>

          {/* IDs */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Identificadores</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InfoCard title="User ID (você)" value={data.userId} />
              <InfoCard
                title="Effective Owner ID (conta ativa)"
                value={data.effectiveOwnerId}
                highlight={isViewingSharedAccount || false}
              />
            </div>
          </div>

          {/* Cookie info */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Cookie recebido pelo servidor</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InfoCard title="Cookie raw" value={data.rawCookie} />
              <InfoCard title="Cookie Owner ID (decoded)" value={data.cookieOwnerId} />
            </div>
          </div>

          {/* Status checks */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Verificações</h3>
            <div className="space-y-2">
              <StatusBadge ok={data.membershipFound} label="Membership encontrada via RLS (você tem acesso à conta compartilhada)" />
              <StatusBadge ok={data.adminMembershipFound} label="Membership existe no banco (via admin, bypass RLS)" />
              <StatusBadge ok={data.canReadOwnerAccounts} label="Pode ler accounts do owner (RLS permite)" />
              <StatusBadge ok={data.canReadOwnerTransactions} label="Pode ler transactions do owner (RLS permite)" />
            </div>
          </div>

          {/* Owner data counts */}
          {data.cookieOwnerId && data.cookieOwnerId !== data.userId && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Dados do Owner (via admin)</h3>
              <div className="grid grid-cols-2 gap-3">
                <InfoCard title="Contas do owner" value={String(data.ownerAccountsCount || 0)} />
                <InfoCard title="Transações do owner" value={String(data.ownerTransactionsCount || 0)} />
              </div>
              {data.ownerAccountsCount === 0 && data.ownerTransactionsCount === 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Aviso:</strong> O owner não tem dados (contas ou transações). Talvez seja uma conta nova.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {!data.membershipFound && data.adminMembershipFound && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800 dark:text-red-200">
                <strong>Problema de RLS:</strong> A membership existe no banco, mas RLS está bloqueando a leitura.
                Verifique se a migration <code className="bg-muted px-1 rounded">027_account_sharing.sql</code> foi aplicada corretamente.
              </div>
            </div>
          )}

          {!data.membershipFound && !data.adminMembershipFound && data.cookieOwnerId && data.cookieOwnerId !== data.userId && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800 dark:text-red-200">
                <strong>Problema:</strong> Não existe membership entre você e o owner. O convite pode não ter sido aceito corretamente.
              </div>
            </div>
          )}

          {data.membershipFound && !data.canReadOwnerAccounts && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800 dark:text-red-200">
                <strong>Problema:</strong> Membership encontrada, mas RLS está bloqueando leitura de accounts.
                Verifique se a migration <code className="bg-muted px-1 rounded">028_shared_access_rls.sql</code> ou{' '}
                <code className="bg-muted px-1 rounded">041_reapply_shared_access_rls.sql</code> foi aplicada.
              </div>
            </div>
          )}

          {isViewingSharedAccount && data.canReadOwnerAccounts && data.canReadOwnerTransactions && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-800 dark:text-green-200">
                <strong>✅ Tudo OK:</strong> Você está visualizando uma conta compartilhada e tem acesso aos dados do owner.
              </div>
            </div>
          )}

          {/* Errors */}
          {data.membershipError && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-destructive">Erro ao buscar membership:</div>
              <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto">
                {JSON.stringify(data.membershipError, null, 2)}
              </pre>
            </div>
          )}

          {data.accountsError && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-destructive">Erro ao ler accounts:</div>
              <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto">
                {JSON.stringify(data.accountsError, null, 2)}
              </pre>
            </div>
          )}

          {data.transactionsError && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-destructive">Erro ao ler transactions:</div>
              <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto">
                {JSON.stringify(data.transactionsError, null, 2)}
              </pre>
            </div>
          )}

          {/* Membership details */}
          {data.membership && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Detalhes da membership (via RLS):</div>
              <pre className="text-xs bg-muted/30 rounded p-2 overflow-auto border border-border">
                {JSON.stringify(data.membership, null, 2)}
              </pre>
            </div>
          )}

          {/* Admin Membership details (if different from RLS) */}
          {data.adminMembership && !data.membership && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Detalhes da membership (via admin, bypass RLS):</div>
              <pre className="text-xs bg-muted/30 rounded p-2 overflow-auto border border-border">
                {JSON.stringify(data.adminMembership, null, 2)}
              </pre>
            </div>
          )}

          {/* Raw JSON */}
          <details className="mt-4">
            <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground">
              Ver JSON completo
            </summary>
            <pre className="text-xs overflow-auto bg-muted/30 rounded-lg p-3 border border-border mt-2">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {!data && !error && (
        <div className="glass-card p-4 md:p-6">
          <div className="text-sm text-muted-foreground text-center">
            {loading ? 'Carregando dados do servidor...' : 'Sem dados.'}
          </div>
        </div>
      )}
    </div>
  );
}

