'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface PluggyItem {
  id: string;
  item_id: string;
  institution_name: string;
  institution_logo: string | null;
  status: string;
  last_sync_at: string | null;
  created_at: string;
  pluggy_sync_logs?: {
    status: string;
    finished_at: string | null;
    accounts_synced: number;
    transactions_synced: number;
  }[];
}

interface UserPlan {
  plan: string;
  status: string;
}

export default function IntegrationsPage() {
  const [items, setItems] = useState<PluggyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchItems();
    fetchUserPlan();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/pluggy/items');
      const data = await res.json();
      setItems(data.data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast({
        title: 'Erro',
        description: 'Nao foi possivel carregar as integracoes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPlan = async () => {
    try {
      const res = await fetch('/api/billing/plan');
      const data = await res.json();
      setUserPlan(data);
    } catch (error) {
      console.error('Error fetching plan:', error);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/pluggy/connect-token', {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao conectar');
      }

      const data = await res.json();

      // Open Pluggy Connect in a new window
      // In production, you would use the Pluggy SDK
      toast({
        title: 'Conectar Banco',
        description: 'Token de conexao gerado. Implemente o Pluggy Connect SDK.',
      });

      console.log('Connect token:', data.connectToken);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSync = async (itemId: string) => {
    try {
      setSyncing(itemId);
      const res = await fetch(`/api/pluggy/sync/${itemId}`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao sincronizar');
      }

      toast({
        title: 'Sincronizacao iniciada',
        description: 'Os dados estao sendo atualizados',
      });

      // Refresh items after a delay
      setTimeout(fetchItems, 3000);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (itemId: string) => {
    if (!confirm('Tem certeza que deseja desconectar esta conta?')) {
      return;
    }

    try {
      const res = await fetch(`/api/pluggy/items/${itemId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao desconectar');
      }

      toast({
        title: 'Conta desconectada',
        description: 'A integracao foi removida com sucesso',
      });

      fetchItems();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      UPDATED: { color: 'bg-green-500/10 text-green-500 border-green-500/20', label: 'Atualizado' },
      UPDATING: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'Atualizando' },
      WAITING_USER_INPUT: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', label: 'Aguardando' },
      LOGIN_ERROR: { color: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Erro de Login' },
      OUTDATED: { color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', label: 'Desatualizado' },
    };

    const { color, label } = statusMap[status] || { color: 'bg-muted text-muted-foreground', label: status };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${color}`}>
        {label}
      </span>
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleString('pt-BR');
  };

  const canConnect = userPlan?.plan === 'business';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Integracoes</h1>
          <p className="text-muted-foreground">Conecte suas contas bancarias via Open Finance</p>
        </div>
        {canConnect && (
          <Button onClick={handleConnect} className="btn-primary">
            <i className='bx bx-plus'></i>
            Conectar Banco
          </Button>
        )}
      </div>

      {!canConnect && (
        <div className="glass-card p-6 border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
              <i className='bx bx-crown text-xl text-yellow-500'></i>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Recurso Premium</h3>
              <p className="text-sm text-muted-foreground mb-3">
                A integracao bancaria via Open Finance esta disponivel apenas no plano Business.
                Faca upgrade para conectar suas contas automaticamente.
              </p>
              <Button variant="outline" asChild>
                <a href="/pricing">Ver Planos</a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <i className='bx bx-link text-3xl text-primary'></i>
          </div>
          <h3 className="font-display font-semibold text-lg mb-2">Nenhuma integracao</h3>
          <p className="text-muted-foreground mb-4">
            Conecte suas contas bancarias para importar transacoes automaticamente.
          </p>
          {canConnect && (
            <Button onClick={handleConnect} className="btn-primary">
              <i className='bx bx-plus'></i>
              Conectar Primeiro Banco
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => {
            const lastSync = item.pluggy_sync_logs?.[0];
            return (
              <div key={item.id} className="glass-card p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                      {item.institution_logo ? (
                        <img
                          src={item.institution_logo}
                          alt={item.institution_name}
                          className="w-8 h-8 object-contain"
                        />
                      ) : (
                        <i className='bx bx-bank text-2xl text-muted-foreground'></i>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">{item.institution_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(item.status)}
                        <span className="text-xs text-muted-foreground">
                          Ultima sync: {formatDate(item.last_sync_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(item.item_id)}
                      disabled={syncing === item.item_id}
                    >
                      {syncing === item.item_id ? (
                        <i className='bx bx-loader-alt bx-spin'></i>
                      ) : (
                        <i className='bx bx-refresh'></i>
                      )}
                      Sincronizar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(item.item_id)}
                      className="text-red-500 hover:text-red-600 hover:border-red-500"
                    >
                      <i className='bx bx-unlink'></i>
                    </Button>
                  </div>
                </div>

                {lastSync && (
                  <div className="mt-4 pt-4 border-t border-border flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <i className='bx bx-wallet'></i>
                      <span>{lastSync.accounts_synced || 0} contas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <i className='bx bx-transfer'></i>
                      <span>{lastSync.transactions_synced || 0} transacoes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <i className='bx bx-time'></i>
                      <span>{formatDate(lastSync.finished_at)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="glass-card p-6">
        <h3 className="font-display font-semibold mb-4">Sobre o Open Finance</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <i className='bx bx-shield-quarter text-green-500'></i>
            </div>
            <div>
              <h4 className="font-medium text-sm">Seguro</h4>
              <p className="text-xs text-muted-foreground">Conexao criptografada e regulamentada pelo Banco Central</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <i className='bx bx-sync text-blue-500'></i>
            </div>
            <div>
              <h4 className="font-medium text-sm">Automatico</h4>
              <p className="text-xs text-muted-foreground">Transacoes importadas automaticamente todos os dias</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <i className='bx bx-lock-alt text-purple-500'></i>
            </div>
            <div>
              <h4 className="font-medium text-sm">Privado</h4>
              <p className="text-xs text-muted-foreground">Voce controla quais dados compartilhar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
