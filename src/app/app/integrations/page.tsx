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
  connector_name: string;
  connector_id: string;
  status: string;
  execution_status: string;
  created_at: string;
  updated_at: string;
  pluggy_sync_logs?: {
    status: string;
    finished_at: string | null;
    accounts_synced: number;
    transactions_synced: number;
  }[];
}

interface PluggyLogos {
  [itemId: string]: string | null;
}

interface UserPlan {
  plan: string;
  status: string;
  features?: Record<string, { enabled?: boolean }>;
  limits?: {
    whatsapp_integration?: boolean;
    pluggy_integration?: boolean;
    [key: string]: any;
  };
}

interface UserProfile {
  role: string;
}

interface PluggyStatus {
  configured: boolean;
  connected: boolean;
  enabled: boolean;
}

export default function IntegrationsPage() {
  const [items, setItems] = useState<PluggyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [pluggyStatus, setPluggyStatus] = useState<PluggyStatus | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [pluggyLogos, setPluggyLogos] = useState<PluggyLogos>({});
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  useEffect(() => {
    fetchUserPlan();
    fetchUserProfile();
  }, []);

  // Fetch Pluggy status and items only when user is admin
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchPluggyStatus();
      fetchItems();
      fetchPluggyLogos();
    } else if (userProfile !== null) {
      // Non-admin users don't see Pluggy items
      setLoading(false);
    }
  }, [userProfile]);

  const fetchPluggyStatus = async () => {
    try {
      const res = await fetch('/api/admin/pluggy/status');
      if (res.ok) {
        const data = await res.json();
        console.log('[Integrations] Pluggy status:', data);
        setPluggyStatus(data);
      } else {
        console.log('[Integrations] Pluggy status fetch failed:', res.status);
      }
    } catch (error) {
      console.error('Error fetching Pluggy status:', error);
    }
  };

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

  const fetchPluggyLogos = async () => {
    try {
      const res = await fetch('/api/pluggy/items-logos');
      if (res.ok) {
        const data = await res.json();
        setPluggyLogos(data.logos || {});
      }
    } catch (error) {
      console.error('Error fetching Pluggy logos:', error);
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
      console.log('[Integrations] User profile:', { role: data.role, email: data.email });
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
          script.src = 'https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js';
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
        onSuccess: async (data: { item: { id: string; institutionName?: string; institution?: string } }) => {
          try {
            // Register the item in our database
            const registerRes = await fetch('/api/pluggy/items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ itemId: data.item.id }),
            });

            if (!registerRes.ok) {
              const errorData = await registerRes.json();
              console.error('[Pluggy] Failed to register item:', errorData);
            }

            toast({
              title: 'Conta conectada!',
              description: `${data.item.institutionName || data.item.institution || 'Instituição'} foi conectada com sucesso. Sincronizando dados...`,
            });
            
            // Delay to allow background sync to start
            setTimeout(() => {
              fetchItems();
              fetchPluggyLogos();
            }, 2000);
          } catch (err) {
            console.error('[Pluggy] Error in onSuccess:', err);
            toast({
              title: 'Conta conectada',
              description: 'Conexão realizada, mas houve um erro ao registrar. Tente sincronizar manualmente.',
              variant: 'destructive',
            });
            fetchItems();
          }
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
      setTimeout(() => {
        fetchItems();
        fetchPluggyLogos();
      }, 3000);
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
        description: 'A integração foi removida com sucesso',
      });

      fetchItems();
      fetchPluggyLogos();
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
      SUCCESS: { color: 'bg-green-500/10 text-positive border-green-500/20', label: 'Conectado' },
      UPDATED: { color: 'bg-green-500/10 text-positive border-green-500/20', label: 'Atualizado' },
      UPDATING: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'Atualizando' },
      WAITING_USER_INPUT: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', label: 'Aguardando' },
      LOGIN_ERROR: { color: 'bg-red-500/10 text-negative border-red-500/20', label: 'Erro de Login' },
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

  // Open Finance (Pluggy) is only available for admin users when enabled and configured
  const isAdmin = userProfile?.role === 'admin';
  const isPluggyConfigured = pluggyStatus?.configured && pluggyStatus?.enabled;
  const canConnectPluggy = isAdmin && isPluggyConfigured;
  // WhatsApp is available for premium users OR based on plan features
  const canConnectWhatsApp =
    userPlan?.features?.integrations?.enabled === true || userPlan?.limits?.whatsapp_integration === true;

  // Debug log
  console.log('[Integrations] Render state:', {
    isAdmin,
    isPluggyConfigured,
    canConnectPluggy,
    pluggyStatus,
    userProfileRole: userProfile?.role,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Integrações</h1>
          <p className="text-muted-foreground">Gerencie suas integrações e automações</p>
        </div>
      </div>

      {/* Open Finance Section - Admin Only */}
      {isAdmin && !isPluggyConfigured && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold">Open Finance</h2>
            <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">Admin</span>
          </div>
          <div className="glass-card p-6 border-yellow-500/20 bg-yellow-500/5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <i className='bx bx-cog text-xl text-yellow-500'></i>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Configuração Necessária</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {!pluggyStatus?.configured 
                    ? 'Configure as credenciais da API Pluggy para habilitar a integração Open Finance.'
                    : 'A integração Open Finance está desabilitada. Habilite nas configurações do admin.'}
                </p>
                <Button variant="outline" asChild>
                  <a href="/app/admin">
                    <i className='bx bx-cog mr-2'></i>
                    Ir para Configurações
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {canConnectPluggy && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold">Open Finance</h2>
              <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">Admin</span>
            </div>
            <Button onClick={handleConnect} className="btn-primary w-full sm:w-auto">
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
                const institutionLogo = pluggyLogos[item.item_id];
                return (
                  <div key={item.id} className="glass-card p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {institutionLogo ? (
                            <img
                              src={institutionLogo}
                              alt={item.connector_name || 'Instituição'}
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                // Fallback to icon if image fails to load
                                (e.target as HTMLElement).style.display = 'none';
                                const parent = (e.target as HTMLElement).parentElement;
                                if (parent) {
                                  const icon = document.createElement('i');
                                  icon.className = 'bx bx-bank text-2xl text-muted-foreground';
                                  parent.appendChild(icon);
                                }
                              }}
                            />
                          ) : (
                            <i className='bx bx-bank text-2xl text-muted-foreground'></i>
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold">{item.connector_name || 'Instituição'}</h3>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 mt-1">
                            {getStatusBadge(item.execution_status || item.status)}
                            <span className="text-xs text-muted-foreground">
                              Última atualização: {formatDate(lastSync?.finished_at || item.updated_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
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
                          className="text-negative hover:text-red-600 hover:border-red-500"
                        >
                          <i className='bx bx-unlink'></i>
                        </Button>
                      </div>
                    </div>

                    {lastSync && (
                      <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-6">
                        <div className="flex items-center gap-2">
                          <i className='bx bx-wallet'></i>
                          <span>{lastSync.accounts_synced || 0} contas</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <i className='bx bx-arrow-right-left'></i>
                          <span>{lastSync.transactions_synced || 0} novas transações</span>
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
      )}

      {/* Info section - show for admin users with Open Finance access */}
      {canConnectPluggy && (
        <div className="glass-card p-6">
          <h3 className="font-display font-semibold mb-4">Sobre o Open Finance</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <i className='bx bx-shield text-positive'></i>
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
                <i className='bx bxl-whatsapp text-xl text-positive'></i>
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
