'use client';

import { useState, useEffect, Suspense } from 'react';
import { format } from 'date-fns';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buscarCep, buscarEstados, buscarCidadesPorEstado, type Estado, type Cidade } from '@/services/brasil-api/client';
import SharingSection from '@/components/sharing/SharingSection';
import { formatCurrency, processCurrencyInput, parseCurrencyToCents } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';

const GENDER_OPTIONS = [
  { label: 'Homem', value: 'male_cis' },
  { label: 'Mulher', value: 'female_cis' },
  { label: 'Não-binário', value: 'non_binary' },
  { label: 'Outro', value: 'other' },
  { label: 'Prefiro não responder', value: 'prefer_not_to_say' },
] as const;

// Função para converter valor do banco para label exibido
const getGenderLabel = (value: string | null): string => {
  if (!value) return '';
  const option = GENDER_OPTIONS.find(opt => opt.value === value);
  return option ? option.label : '';
};

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  birth_date: string | null;
  gender: string | null;
  cep: string | null;
  monthly_income_cents: number | null;
  created_at: string;
}

interface UserPlan {
  plan: string;
  status: string;
  current_period_end?: string;
}

// PlanPrice and UserPlan interfaces are still used for type definitions if needed, 
// but local fetching of prices is removed.


function SettingsPageContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    avatar_url: '',
    city: '',
    state: '',
    birth_date: '',
    gender: '',
    cep: '',
    monthly_income: '',
  });
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [cep, setCep] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { openUpgradeModal } = useUpgradeModal();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('profile');

  // Sincronizar aba ativa com query params
  useEffect(() => {
    const tabFromUrl = searchParams?.get('tab') || 'profile';
    setActiveTab(tabFromUrl);
  }, [searchParams]);

  // Atualizar URL quando a aba mudar
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/app/settings?tab=${value}`, { scroll: false });
  };

  useEffect(() => {
    fetchProfile();
    fetchPlan();
    loadEstados();
  }, []);

  // fetchPlanPrices removed as it's now in UpgradeModal component

  // Carregar estados ao montar o componente
  const loadEstados = async () => {
    try {
      const estadosData = await buscarEstados();
      setEstados(estadosData.sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (error) {
      console.error('Erro ao carregar estados:', error);
    }
  };

  // Carregar cidades quando o estado for selecionado
  useEffect(() => {
    async function loadCidades() {
      if (!formData.state) {
        setCidades([]);
        return;
      }

      try {
        const cidadesData = await buscarCidadesPorEstado(formData.state);
        setCidades(cidadesData.sort((a, b) => a.nome.localeCompare(b.nome)));
        // Se a cidade atual não existir na nova lista, limpar
        setFormData((prev) => {
          if (prev.city && !cidadesData.some(c => c.nome === prev.city)) {
            return { ...prev, city: '' };
          }
          return prev;
        });
      } catch (error) {
        console.error('Erro ao carregar cidades:', error);
        setCidades([]);
      }
    }
    loadCidades();
  }, [formData.state]);

  // Função para normalizar nome de cidade (remove acentos, converte para minúsculas)
  const normalizeCityName = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  // Buscar CEP quando o usuário terminar de digitar
  const handleCepBlur = async () => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      setLoadingCep(true);
      try {
        const dados = await buscarCep(cepLimpo);
        if (dados) {
          // Primeiro, carrega as cidades do estado retornado
          const cidadesData = await buscarCidadesPorEstado(dados.state);
          const cidadesSorted = cidadesData.sort((a, b) => a.nome.localeCompare(b.nome));
          setCidades(cidadesSorted);

          // Tenta encontrar a cidade que corresponde ao nome retornado pela API
          const cidadeEncontrada = cidadesSorted.find(
            (c) => normalizeCityName(c.nome) === normalizeCityName(dados.city)
          );

          let cidadeParaPreencher = '';
          if (cidadeEncontrada) {
            cidadeParaPreencher = cidadeEncontrada.nome;
          } else {
            // Se não encontrar exato, tenta encontrar por contém
            const cidadeParcial = cidadesSorted.find(
              (c) => normalizeCityName(c.nome).includes(normalizeCityName(dados.city)) ||
                normalizeCityName(dados.city).includes(normalizeCityName(c.nome))
            );
            if (cidadeParcial) {
              cidadeParaPreencher = cidadeParcial.nome;
            }
          }

          // Define estado e cidade
          setFormData((prev) => ({
            ...prev,
            state: dados.state,
            city: cidadeParaPreencher,
          }));
        } else {
          // CEP não encontrado ou inválido
          toast({
            variant: 'destructive',
            title: 'CEP inválido',
            description: 'CEP não encontrado. Verifique o CEP digitado e tente novamente.',
          });
          setCep(''); // Limpa o campo CEP
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        toast({
          variant: 'destructive',
          title: 'Erro ao buscar CEP',
          description: 'Não foi possível buscar o endereço. Tente novamente mais tarde.',
        });
      } finally {
        setLoadingCep(false);
      }
    } else if (cep.replace(/\D/g, '').length > 0) {
      toast({
        variant: 'destructive',
        title: 'CEP inválido',
        description: 'CEP deve conter 8 dígitos.',
      });
    }
  };

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
            avatar_url: profileData.avatar_url,
            city: profileData.city,
            state: profileData.state,
            birth_date: profileData.birth_date,
            gender: profileData.gender,
            cep: profileData.cep,
            monthly_income_cents: profileData.monthly_income_cents,
            created_at: user.created_at,
          });
          setFormData({
            full_name: profileData.full_name || '',
            avatar_url: profileData.avatar_url || '',
            city: profileData.city || '',
            state: profileData.state || '',
            birth_date: profileData.birth_date || '',
            gender: profileData.gender || '',
            cep: profileData.cep || '',
            monthly_income: profileData.monthly_income_cents
              ? (profileData.monthly_income_cents / 100).toFixed(2)
              : '',
          });
          if (profileData.cep) {
            setCep(profileData.cep);
          }
          if (profileData.birth_date) {
            // Treats date as local instead of UTC to prevent timezone shifts
            const [year, month, day] = profileData.birth_date.split('-').map(Number);
            setBirthDate(new Date(year, month - 1, day));
          } else {
            setBirthDate(undefined);
          }
          if (profileData.avatar_url) {
            setAvatarPreview(profileData.avatar_url);
          }
        } else {
          setProfile({
            id: user.id,
            full_name: null,
            email: user.email || '',
            avatar_url: null,
            city: null,
            state: null,
            birth_date: null,
            gender: null,
            cep: null,
            monthly_income_cents: null,
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Formato de arquivo inválido',
        description: 'Por favor, selecione um arquivo de imagem válido (PNG, JPG, GIF ou WEBP)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB max for avatars)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Imagem muito grande',
        description: 'A imagem selecionada excede o tamanho máximo permitido de 5MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploadingAvatar(true);
      const formDataToUpload = new FormData();
      formDataToUpload.append('file', file);
      formDataToUpload.append('folder', 'avatars');
      formDataToUpload.append('public', 'false');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataToUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload da imagem');
      }

      const result = await response.json();

      // Update profile immediately with new avatar
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            avatar_url: result.url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (updateError) throw updateError;

        // Notify other components that profile has been updated
        window.dispatchEvent(new Event('profile-updated'));

        setFormData({ ...formData, avatar_url: result.url });
        setProfile(prev => prev ? { ...prev, avatar_url: result.url } : null);
        setAvatarPreview(result.url);

        toast({
          title: 'Avatar atualizado',
          description: 'Sua foto de perfil foi atualizada com sucesso',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Falha no upload da imagem',
        description: error.message || 'Não foi possível fazer o upload da imagem. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      const supabase = createClient();

      const { error } = await supabase
        .from('profiles')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      // Notify other components that profile has been updated
      window.dispatchEvent(new Event('profile-updated'));

      setFormData({ ...formData, avatar_url: '' });
      setProfile(prev => prev ? { ...prev, avatar_url: null } : null);
      setAvatarPreview(null);

      toast({
        title: 'Avatar removido',
        description: 'Sua foto de perfil foi removida',
      });
    } catch (error: any) {
      toast({
        title: 'Falha ao remover avatar',
        description: error.message || 'Não foi possível remover o avatar. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      const supabase = createClient();

      const monthlyIncomeCents = formData.monthly_income
        ? parseCurrencyToCents(formData.monthly_income)
        : null;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name || null,
          avatar_url: formData.avatar_url || null,
          city: formData.city || null,
          state: formData.state || null,
          birth_date: birthDate ? format(birthDate, 'yyyy-MM-dd') : null,
          gender: formData.gender || null,
          cep: cep || null,
          monthly_income_cents: monthlyIncomeCents,
        })
        .eq('id', profile.id);

      if (error) throw error;

      // If monthly income changed, update or create emergency fund goal
      if (monthlyIncomeCents && monthlyIncomeCents > 0) {
        const { error: rpcError } = await supabase.rpc('setup_new_user', { p_user_id: profile.id });
        if (rpcError) {
          console.error('Error updating emergency fund goal:', rpcError);
          // Don't throw here, just log - profile update was successful
        }
      }

      // Notify other components that profile has been updated
      window.dispatchEvent(new Event('profile-updated'));

      toast({
        title: 'Perfil atualizado',
        description: 'Suas informacoes foram salvas com sucesso',
      });

      setProfile(prev => prev ? {
        ...prev,
        full_name: formData.full_name,
        avatar_url: formData.avatar_url || null,
        city: formData.city || null,
        state: formData.state || null,
        birth_date: birthDate ? birthDate.toISOString().split('T')[0] : null,
        gender: formData.gender || null,
        cep: cep || null,
        monthly_income_cents: monthlyIncomeCents,
      } : null);
    } catch (error: any) {
      console.error('Error saving profile:', JSON.stringify(error, null, 2));
      toast({
        title: 'Falha ao salvar perfil',
        description: error.message || 'Não foi possível salvar as alterações no perfil. Tente novamente.',
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
        title: 'Falha ao acessar portal de cobrança',
        description: error.message || 'Não foi possível acessar o portal de cobrança. Tente novamente mais tarde.',
        variant: 'destructive',
      });
    }
  };

  // Removed local handleUpgrade as it's now in the global UpgradeModal component

  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        const errorMessage = errorData.error || 'Erro ao cancelar assinatura';

        // If subscription was cleaned up automatically, refresh plan
        if (errorMessage.includes('registro local foi limpo')) {
          await fetchPlan();
        }

        throw new Error(errorMessage);
      }

      const data = await res.json();

      toast({
        title: 'Assinatura cancelada',
        description: data.message || 'Sua assinatura foi cancelada. Você continuará com acesso até o fim do período atual.',
      });

      // Refresh plan data
      await fetchPlan();
      setShowCancelDialog(false);
    } catch (error: any) {
      toast({
        title: 'Falha ao cancelar assinatura',
        description: error.message || 'Não foi possível cancelar a assinatura. Tente novamente mais tarde.',
        variant: 'destructive',
      });

      // If error mentions cleanup, refresh plan anyway
      if (error.message && error.message.includes('registro local foi limpo')) {
        await fetchPlan();
      }
    } finally {
      setCancelling(false);
    }
  };

  const getPlanLabel = (planName: string) => {
    const plans: Record<string, { label: string; color: string }> = {
      free: { label: 'Gratuito', color: 'bg-muted text-muted-foreground' },
      pro: { label: 'Pro', color: 'bg-blue-500/10 text-blue-500' },
      premium: { label: 'Premium', color: 'bg-amber-500/10 text-amber-500' },
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
    <div className="space-y-4 md:space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-xl md:text-2xl lg:text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm md:text-base">Gerencie sua conta e preferencias</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 md:space-y-6">
        <TabsList className="bg-muted/50 p-1 w-full sm:w-auto">
          <TabsTrigger value="profile" className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm flex-1 sm:flex-initial">
            <i className="bx bx-user"></i>
            <span>Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="sharing" className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm flex-1 sm:flex-initial">
            <i className="bx bx-share-alt"></i>
            <span>Compartilhamento</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Profile Section - Left Column */}
            <div className="space-y-4 md:space-y-6">
              <div className="glass-card p-4 md:p-6">
                <h2 className="font-display font-semibold text-base md:text-lg mb-3 md:mb-4 flex items-center gap-2">
                  <i className='bx bx-user text-lg md:text-xl text-primary'></i>
                  Perfil
                </h2>
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <label className="block text-xs md:text-sm font-medium mb-1.5 md:mb-2">Foto de Perfil</label>
                    <div className="flex items-center gap-3 md:gap-4">
                      {avatarPreview || profile?.avatar_url ? (
                        <div className="relative flex-shrink-0">
                          <img
                            src={avatarPreview || profile?.avatar_url || ''}
                            alt="Avatar"
                            className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-border"
                          />
                          <button
                            type="button"
                            onClick={handleRemoveAvatar}
                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                            disabled={uploadingAvatar || saving}
                            title="Remover foto"
                          >
                            <i className='bx bx-x text-xs md:text-sm'></i>
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-muted flex items-center justify-center border-2 border-border flex-shrink-0">
                          <i className='bx bx-user text-2xl md:text-3xl text-muted-foreground'></i>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <label className="inline-block cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            disabled={uploadingAvatar}
                          />
                          <span className="btn-secondary inline-flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                            {uploadingAvatar ? (
                              <>
                                <i className='bx bx-loader-alt bx-spin'></i>
                                <span className="hidden sm:inline">Fazendo upload...</span>
                                <span className="sm:hidden">Upload...</span>
                              </>
                            ) : (
                              <>
                                <i className='bx bx-image-add'></i>
                                {avatarPreview || profile?.avatar_url ? 'Alterar' : 'Adicionar'}
                              </>
                            )}
                          </span>
                        </label>
                        <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                          PNG, JPG, GIF ou WEBP (máx. 5MB)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-medium mb-1.5 md:mb-2">Nome completo</label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      placeholder="Seu nome"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium mb-1.5 md:mb-2">Email</label>
                    <input
                      type="email"
                      value={profile?.email || ''}
                      disabled
                      className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base rounded-xl bg-muted/30 border border-border text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1">O email não pode ser alterado</p>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-medium mb-1.5 md:mb-2">CEP (opcional)</label>
                    <input
                      type="text"
                      value={cep}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 8) {
                          setCep(value);
                        }
                      }}
                      onBlur={handleCepBlur}
                      className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      placeholder="00000-000"
                      disabled={saving || loadingCep}
                      maxLength={8}
                    />
                    {loadingCep && (
                      <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Buscando endereço...</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-medium mb-1.5 md:mb-2">Estado</label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) => setFormData({ ...formData, state: value })}
                      disabled={saving || loadingCep}
                    >
                      <SelectTrigger className="w-full px-3 md:px-4 py-2.5 md:py-3 h-auto rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors text-sm md:text-base">
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {estados.map((estado) => (
                          <SelectItem key={estado.sigla} value={estado.sigla}>
                            {estado.nome} ({estado.sigla})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-medium mb-1.5 md:mb-2">Cidade</label>
                    <Select
                      value={formData.city}
                      onValueChange={(value) => setFormData({ ...formData, city: value })}
                      disabled={saving || loadingCep || !formData.state}
                    >
                      <SelectTrigger className="w-full px-3 md:px-4 py-2.5 md:py-3 h-auto rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors text-sm md:text-base">
                        <SelectValue placeholder={formData.state ? "Selecione a cidade" : "Selecione o estado primeiro"} />
                      </SelectTrigger>
                      <SelectContent>
                        {cidades.map((cidade) => (
                          <SelectItem key={cidade.codigo_ibge} value={cidade.nome}>
                            {cidade.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-medium mb-1.5 md:mb-2">Data de Nascimento</label>
                    <DatePicker
                      date={birthDate}
                      setDate={setBirthDate}
                      placeholder="Selecione sua data de nascimento"
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-medium mb-1.5 md:mb-2">Gênero</label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData({ ...formData, gender: value })}
                      disabled={saving}
                    >
                      <SelectTrigger className="w-full px-3 md:px-4 py-2.5 md:py-3 h-auto rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors text-sm md:text-base">
                        <SelectValue placeholder="Selecione o gênero" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label htmlFor="monthlyIncome" className="block text-xs md:text-sm font-medium mb-1.5 md:mb-2">
                      Renda Média Mensal
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm md:text-base pointer-events-none select-none">
                        R$
                      </span>
                      <input
                        type="text"
                        id="monthlyIncome"
                        value={formData.monthly_income}
                        onChange={(e) => {
                          // Digitação livre: NÃO formatar aqui (isso trava o cursor).
                          // Formatação acontece apenas no blur.
                          const raw = e.target.value.replace(/[^\d,.-]/g, '');
                          setFormData({ ...formData, monthly_income: raw });
                        }}
                        onBlur={(e) => {
                          // Garante formatação completa ao perder o foco
                          if (e.target.value) {
                            const formatted = processCurrencyInput(e.target.value);
                            setFormData({ ...formData, monthly_income: formatted });
                          }
                        }}
                        className="w-full pl-12 md:pl-14 pr-3 md:pr-4 py-2.5 md:py-3 text-sm md:text-base rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                        placeholder="0,00"
                        disabled={saving}
                      />
                    </div>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                      Se informado, atualizaremos automaticamente o objetivo de Reserva de Emergência (6x a renda mensal)
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSaveProfile} disabled={saving} className="btn-primary text-sm">
                      {saving ? 'Salvando...' : 'Salvar Alteracoes'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="glass-card p-4 md:p-6">
                <h2 className="font-display font-semibold text-base md:text-lg mb-3 md:mb-4 flex items-center gap-2">
                  <i className='bx bx-palette text-lg md:text-xl text-primary'></i>
                  Tema
                </h2>
                <div className="flex flex-col gap-3 md:gap-4">
                  <div>
                    <p className="font-medium text-sm md:text-base">Aparência do app</p>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Escolha entre tema claro ou escuro. O padrão é escuro.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium border transition-colors ${theme === 'light'
                        ? 'bg-primary/10 text-primary border-primary/40'
                        : 'text-muted-foreground border-border/60 hover:text-foreground hover:border-border'
                        }`}
                      aria-pressed={theme === 'light'}
                    >
                      Claro
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium border transition-colors ${theme === 'dark'
                        ? 'bg-primary/10 text-primary border-primary/40'
                        : 'text-muted-foreground border-border/60 hover:text-foreground hover:border-border'
                        }`}
                      aria-pressed={theme === 'dark'}
                    >
                      Escuro
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Subscription, Account Info, and Danger Zone */}
            <div className="space-y-4 md:space-y-6">
              {/* Subscription Section */}
              <div className="glass-card p-4 md:p-6">
                <h2 className="font-display font-semibold text-base md:text-lg mb-3 md:mb-4 flex items-center gap-2">
                  <i className='bx bx-credit-card text-lg md:text-xl text-primary'></i>
                  Assinatura
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm md:text-base">Plano atual:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlanLabel(plan?.plan || 'free').color}`}>
                      {getPlanLabel(plan?.plan || 'free').label}
                    </span>
                  </div>
                  {plan?.current_period_end && (
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Proxima cobranca: {new Date(plan.current_period_end).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex gap-2 flex-wrap">
                      {plan?.plan !== 'premium' && (
                        <Button variant="default" onClick={openUpgradeModal} className="flex-1 min-w-[120px] text-xs md:text-sm">
                          Upgrade
                        </Button>
                      )}
                      {plan?.plan !== 'free' && (
                        <Button variant="outline" onClick={handleManageBilling} className="flex-1 min-w-[100px] text-xs md:text-sm">
                          Gerenciar
                        </Button>
                      )}
                    </div>
                    {plan?.plan !== 'free' && (
                      <Button
                        variant="outline"
                        onClick={() => setShowCancelDialog(true)}
                        className="w-full border-red-500/50 text-negative hover:bg-red-500/10 text-xs md:text-sm"
                      >
                        <i className='bx bx-x-circle mr-1.5 md:mr-2'></i>
                        Cancelar Assinatura
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Account Info Section */}
              <div className="glass-card p-4 md:p-6">
                <h2 className="font-display font-semibold text-base md:text-lg mb-3 md:mb-4 flex items-center gap-2">
                  <i className='bx bx-info-circle text-lg md:text-xl text-primary'></i>
                  Informacoes da Conta
                </h2>
                <div className="space-y-3 text-xs md:text-sm">
                  <div className="flex justify-between py-2 border-b border-border gap-2">
                    <span className="text-muted-foreground">ID da conta</span>
                    <span className="font-mono text-[10px] md:text-xs truncate max-w-[120px] md:max-w-none">{profile?.id}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Membro desde</span>
                    <span>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '-'}</span>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="glass-card p-4 md:p-6 border-red-500/20">
                <h2 className="font-display font-semibold text-base md:text-lg mb-3 md:mb-4 flex items-center gap-2 text-negative">
                  <i className='bx bx-error text-lg md:text-xl'></i>
                  Zona de Perigo
                </h2>
                <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">
                  Ações irreversíveis. Tenha cuidado ao utilizar estas opções.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="border-red-500/50 text-negative hover:bg-red-500/10 w-full text-xs md:text-sm"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <i className='bx bx-trash'></i>
                    Excluir Conta
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sharing">
          <div className="glass-card p-6">
            <SharingSection />
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-negative flex items-center gap-2">
              <i className='bx bx-error-circle text-xl'></i>
              Confirmar Exclusão de Conta
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-4">
              <p>
                Esta ação é <strong>irreversível</strong> e irá excluir permanentemente sua conta e todos os dados associados.
              </p>
              <p>
                Para confirmar, digite <strong className="text-negative">EXCLUIR</strong> no campo abaixo:
              </p>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Digite EXCLUIR para confirmar"
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                autoFocus
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={() => {
                setDeleteConfirmation('');
                setShowDeleteDialog(false);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteConfirmation !== 'EXCLUIR') {
                  toast({
                    variant: 'destructive',
                    title: 'Confirmação inválida',
                    description: 'Você deve digitar "EXCLUIR" para confirmar a exclusão.',
                  });
                  return;
                }

                try {
                  setDeleting(true);
                  // Aqui você pode implementar a lógica real de exclusão
                  // Por enquanto, vamos apenas mostrar uma mensagem
                  toast({
                    title: 'Contate o suporte',
                    description: 'Para excluir sua conta, entre em contato conosco através do suporte.',
                    variant: 'default',
                  });
                  setShowDeleteDialog(false);
                  setDeleteConfirmation('');
                } catch (error: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Erro ao processar solicitação',
                    description: error.message || 'Não foi possível processar a solicitação. Tente novamente mais tarde.',
                  });
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleteConfirmation !== 'EXCLUIR' || deleting}
              className="bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? (
                <>
                  <i className='bx bx-loader-alt bx-spin mr-2'></i>
                  Processando...
                </>
              ) : (
                <>
                  <i className='bx bx-trash mr-2'></i>
                  Excluir Conta Permanentemente
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-negative flex items-center gap-2">
              <i className='bx bx-error-circle text-xl'></i>
              Cancelar Assinatura
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-4">
              <div>
                Tem certeza que deseja cancelar sua assinatura?
              </div>
              <div className="text-sm">
                Sua assinatura será cancelada ao final do período atual ({plan?.current_period_end ? new Date(plan.current_period_end).toLocaleDateString('pt-BR') : ''}).
                Você continuará tendo acesso a todas as funcionalidades até essa data.
              </div>
              <div className="text-sm text-muted-foreground">
                Após o cancelamento, você poderá reativar sua assinatura a qualquer momento.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowCancelDialog(false)}>
              Manter Assinatura
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={cancelling}
              className="bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? (
                <>
                  <i className='bx bx-loader-alt bx-spin mr-2'></i>
                  Cancelando...
                </>
              ) : (
                <>
                  <i className='bx bx-x-circle mr-2'></i>
                  Sim, Cancelar Assinatura
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upgrade Modal is now global and handled by AppLayout */}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
