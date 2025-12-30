'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  created_at: string;
}

interface UserPlan {
  plan: string;
  status: string;
  current_period_end?: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
    fetchPlan();
  }, []);

  const fetchProfile = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setProfile({
            id: user.id,
            full_name: profileData.full_name,
            email: profileData.email || user.email || '',
            created_at: user.created_at,
          });
          setFormData({
            full_name: profileData.full_name || '',
          });
        } else {
          setProfile({
            id: user.id,
            full_name: null,
            email: user.email || '',
            created_at: user.created_at,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlan = async () => {
    try {
      const res = await fetch('/api/billing/plan');
      const data = await res.json();
      setPlan(data);
    } catch (error) {
      console.error('Error fetching plan:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      const supabase = createClient();

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: profile.id,
          full_name: formData.full_name,
          email: profile.email,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: 'Perfil atualizado',
        description: 'Suas informacoes foram salvas com sucesso',
      });

      setProfile(prev => prev ? { ...prev, full_name: formData.full_name } : null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Nao foi possivel salvar o perfil',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Erro ao abrir portal');
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getPlanLabel = (planName: string) => {
    const plans: Record<string, { label: string; color: string }> = {
      free: { label: 'Gratuito', color: 'bg-muted text-muted-foreground' },
      pro: { label: 'Pro', color: 'bg-blue-500/10 text-blue-500' },
      business: { label: 'Business', color: 'bg-purple-500/10 text-purple-500' },
    };
    return plans[planName] || plans.free;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Configuracoes</h1>
        <p className="text-muted-foreground">Gerencie sua conta e preferencias</p>
      </div>

      {/* Profile Section */}
      <div className="glass-card p-6">
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <i className='bx bx-user text-xl text-primary'></i>
          Perfil
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nome completo</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              placeholder="Seu nome"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">O email nao pode ser alterado</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Salvar Alteracoes'}
            </Button>
          </div>
        </div>
      </div>

      {/* Subscription Section */}
      <div className="glass-card p-6">
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <i className='bx bx-credit-card text-xl text-primary'></i>
          Assinatura
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">Plano atual:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlanLabel(plan?.plan || 'free').color}`}>
                {getPlanLabel(plan?.plan || 'free').label}
              </span>
            </div>
            {plan?.current_period_end && (
              <p className="text-sm text-muted-foreground">
                Proxima cobranca: {new Date(plan.current_period_end).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {plan?.plan !== 'business' && (
              <Button variant="outline" asChild>
                <a href="/pricing">Fazer Upgrade</a>
              </Button>
            )}
            {plan?.plan !== 'free' && (
              <Button variant="outline" onClick={handleManageBilling}>
                Gerenciar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Account Info Section */}
      <div className="glass-card p-6">
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <i className='bx bx-info-circle text-xl text-primary'></i>
          Informacoes da Conta
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">ID da conta</span>
            <span className="font-mono text-xs">{profile?.id}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Membro desde</span>
            <span>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '-'}</span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-card p-6 border-red-500/20">
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2 text-red-500">
          <i className='bx bx-error text-xl'></i>
          Zona de Perigo
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Acoes irreversiveis. Tenha cuidado ao utilizar estas opcoes.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-red-500/50 text-red-500 hover:bg-red-500/10"
            onClick={() => {
              toast({
                title: 'Funcionalidade em desenvolvimento',
                description: 'A exportacao de dados estara disponivel em breve',
              });
            }}
          >
            <i className='bx bx-download'></i>
            Exportar Dados
          </Button>
          <Button
            variant="outline"
            className="border-red-500/50 text-red-500 hover:bg-red-500/10"
            onClick={() => {
              toast({
                title: 'Contate o suporte',
                description: 'Para excluir sua conta, entre em contato conosco',
              });
            }}
          >
            <i className='bx bx-trash'></i>
            Excluir Conta
          </Button>
        </div>
      </div>
    </div>
  );
}
