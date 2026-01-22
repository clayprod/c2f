'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import WhatsAppIntegration from '@/components/integrations/WhatsAppIntegration';
import AccountLinking from '@/components/integrations/AccountLinking';

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
  limits?: {
    whatsapp_integration?: boolean;
    pluggy_integration?: boolean;
    [key: string]: any;
  };
}

interface UserProfile {
  role: string;
}

export default function IntegrationsPage() {
  const [items, setItems] = useState<PluggyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  useEffect(() => {
    fetchUserPlan();
    fetchUserProfile();
  }, []);

  // Fetch Pluggy items only when user is admin
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchItems();
    } else if (userProfile !== null) {
      // Non-admin users don't see Pluggy items
      setLoading(false);
    }
  }, [userProfile]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/pluggy/items');
      if (!res.ok) {
        // Non-admin users will get 403, which is expected
        if (res.status === 403) {
          setItems([]);
          return;
        }
        throw new Error('Failed to fetch items');
      }
      const data = await res.json();
      setItems(data.data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      // Only show error for admins, as non-admins are expected to not have access
      if (userProfile?.role === 'admin') {
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar as integrações bancárias',
          variant: 'destructive',
        });
      }
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

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('/api/user/profile');
      const data = await res.json();
      setUserProfile({ role: data.role || 'user' });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/pluggy/connect-token', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao conectar');
      }

      const { connectToken } = data;

      // Load Pluggy Connect SDK from CDN if not already loaded
      if (typeof window !== 'undefined' && !(window as any).PluggyConnect) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2.13.0/pluggy-connect.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Pluggy Connect SDK'));
          document.head.appendChild(script);
        });
      }

      const PluggyConnect = (window as any).PluggyConnect;
      if (!PluggyConnect) {
        throw new Error('Pluggy Connect SDK not available');
      }

      // Initialize Pluggy Connect widget
      new PluggyConnect({
        connectToken,
        onSuccess: (data: { item: { id: string; institutionName?: string; institution?: string } }) => {
          toast({
            title: 'Conta conectada!',
            description: `${data.item.institutionName || data.item.institution || 'Instituição'} foi conectada com sucesso.`,
          });
          fetchItems();
        },
        onError: (error: { message?: string }) => {
          toast({
            title: 'Erro ao conectar',
            description: error.message || 'Ocorreu um erro durante a conexão.',
            variant: 'destructive',
          });
        },
        onClose: () => {
          // Widget was closed, optionally refresh items in case of partial success
          fetchItems();
        },
      }).init();
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
        description: 'Os dados estão sendo atualizados',
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
    const confirmed = await confirm({
      title: 'Desconectar Conta',
      description: 'Tem certeza que deseja desconectar esta conta?',
      confirmText: 'Desconectar',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) {
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

  // Open Finance (Pluggy) is only available for admin users
  const isAdmin = userProfile?.role === 'admin';
  const canConnectPluggy = isAdmin;
  // WhatsApp is available for premium users OR based on plan features
  const canConnectWhatsApp = userPlan?.plan === 'premium' || userPlan?.plan === 'pro' || userPlan?.limits?.whatsapp_integration === true;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Integrações</h1>
          <p className="text-muted-foreground">Gerencie suas integrações e automações</p>
        </div>
      </div>

      {/* Open Finance Section - Admin Only */}
      {canConnectPluggy ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold">Open Finance</h2>
              <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">Admin</span>
            </div>
            <Button onClick={handleConnect} className="btn-primary">
              <i className='bx bx-plus'></i>
              Conectar Banco
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Carregando...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <i className='bx bx-bank text-2xl text-primary'></i>
              </div>
              <h3 className="font-display font-semibold mb-2">Nenhuma conexão bancária</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Conecte contas bancárias para importar transações automaticamente via Open Finance.
              </p>
              <Button onClick={handleConnect} size="sm">
                <i className='bx bx-plus'></i>
                Conectar Primeiro Banco
              </Button>
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
                            <i className='bx bx-repeat'></i>
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
                          <i className='bx bx-arrow-right-left'></i>
                          <span>{lastSync.transactions_synced || 0} transações</span>
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

          {/* Account Linking - Admin Only */}
          {items.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-3">Vincular Contas</h3>
              <AccountLinking onLinkChange={fetchItems} />
            </div>
          )}
        </div>
      ) : null}

      {/* Info section - show for admin users with Open Finance access */}
      {canConnectPluggy && (
        <div className="glass-card p-6">
          <h3 className="font-display font-semibold mb-4">Sobre o Open Finance</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <i className='bx bx-shield text-green-500'></i>
              </div>
              <div>
                <h4 className="font-medium text-sm">Seguro</h4>
                <p className="text-xs text-muted-foreground">Conexão criptografada e regulamentada pelo Banco Central</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <i className='bx bx-repeat text-blue-500'></i>
              </div>
              <div>
                <h4 className="font-medium text-sm">Automático</h4>
                <p className="text-xs text-muted-foreground">Transações importadas automaticamente todos os dias</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <i className='bx bx-lock text-purple-500'></i>
              </div>
              <div>
                <h4 className="font-medium text-sm">Privado</h4>
                <p className="text-xs text-muted-foreground">Você controla quais dados compartilhar</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Integration - Plan based (Pro/Premium) */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold">WhatsApp</h2>
        
        {canConnectWhatsApp ? (
          <WhatsAppIntegration onStatusChange={fetchItems} />
        ) : (
          <div className="glass-card p-6 border-yellow-500/20 bg-yellow-500/5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <i className='bx bxl-whatsapp text-xl text-green-500'></i>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Recurso Pro/Premium</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Gerencie suas transações por mensagens de WhatsApp. Disponível nos planos Pro e Premium.
                </p>
                <Button variant="outline" asChild>
                  <a href="/app/settings">Fazer Upgrade</a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Dialog */}
      {ConfirmDialog}
    </div>
  );
}
