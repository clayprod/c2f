'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { buscarCep, buscarEstados, buscarCidadesPorEstado, type Estado, type Cidade } from '@/services/brasil-api/client';
import { useToast } from '@/hooks/use-toast';
import { cn, parseCurrencyToCents, processCurrencyInput } from '@/lib/utils';

const GENDER_OPTIONS = [
  { label: 'Homem', value: 'male_cis' },
  { label: 'Mulher', value: 'female_cis' },
  { label: 'Nao-binario', value: 'non_binary' },
  { label: 'Outro', value: 'other' },
  { label: 'Prefiro nao responder', value: 'prefer_not_to_say' },
] as const;

interface CompleteProfileFormProps {
  onCompleted?: () => void;
  redirectTo?: string;
  requireAuthRedirect?: boolean;
  redirectIfComplete?: boolean;
  useCard?: boolean;
  className?: string;
}

export default function CompleteProfileForm({
  onCompleted,
  redirectTo = '/app',
  requireAuthRedirect = true,
  redirectIfComplete = true,
  useCard = true,
  className,
}: CompleteProfileFormProps) {
  const [cep, setCep] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [gender, setGender] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [hasAutoFilledFromCep, setHasAutoFilledFromCep] = useState(false);
  const [pendingCityFromCep, setPendingCityFromCep] = useState<string>('');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setEmail(user.email || '');
        setFullName(user.user_metadata?.full_name || user.user_metadata?.name || '');

        if (requireAuthRedirect) {
          // If we need to check if profile is already complete
        }
      } else if (requireAuthRedirect) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, city, state, monthly_income_cents')
        .eq('id', user?.id)
        .single();

      if (profile) {
        if (profile.full_name) setFullName(profile.full_name);
        if (profile.email) setEmail(profile.email);

        if (redirectIfComplete && profile.city && profile.state) {
          router.push(redirectTo);
        }
      }
    };

    checkAuth();
  }, [redirectIfComplete, redirectTo, requireAuthRedirect, router]);

  useEffect(() => {
    async function loadEstados() {
      try {
        const estadosData = await buscarEstados();
        setEstados(estadosData.sort((a, b) => a.nome.localeCompare(b.nome)));
      } catch (error) {
        console.error('Erro ao carregar estados:', error);
      }
    }
    loadEstados();
  }, []);

  useEffect(() => {
    async function loadCidades() {
      if (!state) {
        setCidades([]);
        setCity('');
        setPendingCityFromCep('');
        return;
      }

      // Se o estado foi preenchido pelo CEP, não recarregar as cidades
      // pois o lookupCep já fez isso e definiu a cidade corretamente
      if (hasAutoFilledFromCep) {
        return;
      }

      try {
        const cidadesData = await buscarCidadesPorEstado(state);
        const cidadesSorted = cidadesData.sort((a, b) => a.nome.localeCompare(b.nome));
        setCidades(cidadesSorted);
        setCity((prevCity) => {
          if (prevCity && !cidadesData.some(c => c.nome === prevCity)) {
            return '';
          }
          return prevCity;
        });
      } catch (error) {
        console.error('Erro ao carregar cidades:', error);
        setCidades([]);
      }
    }
    loadCidades();
  }, [state, hasAutoFilledFromCep]);

  // Preencher cidade automaticamente quando as cidades estiverem carregadas e houver uma cidade pendente do CEP
  useEffect(() => {
    if (pendingCityFromCep && cidades.length > 0 && hasAutoFilledFromCep && !city) {
      // Verifica se a cidade pendente existe na lista de cidades (com comparação normalizada)
      const cidadeExiste = cidades.some(c =>
        normalizeCityName(c.nome) === normalizeCityName(pendingCityFromCep) ||
        c.nome === pendingCityFromCep
      );
      if (cidadeExiste || pendingCityFromCep) {
        // Se a cidade existe na lista ou foi adicionada como fallback, preenche
        setCity(pendingCityFromCep);
        setPendingCityFromCep('');
      }
    }
  }, [cidades, pendingCityFromCep, hasAutoFilledFromCep, city]);

  const normalizeCityName = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  const lookupCep = async (opts?: { silent?: boolean }): Promise<{ ok: boolean; state?: string; city?: string }> => {
    const silent = opts?.silent === true;
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      setLoadingCep(true);
      try {
        const dados = await buscarCep(cepLimpo);
        if (dados) {
          const cidadesData = await buscarCidadesPorEstado(dados.state);
          const cidadeDoCep = (dados.city || '').trim();
          const cidadesSorted = cidadesData.sort((a, b) => a.nome.localeCompare(b.nome));

          const cidadeEncontrada = cidadesSorted.find(
            (c) => normalizeCityName(c.nome) === normalizeCityName(cidadeDoCep)
          );

          let cidadeParaPreencher = '';
          if (cidadeEncontrada) {
            cidadeParaPreencher = cidadeEncontrada.nome;
          } else {
            const cidadeParcial = cidadesSorted.find(
              (c) => normalizeCityName(c.nome).includes(normalizeCityName(cidadeDoCep)) ||
                normalizeCityName(cidadeDoCep).includes(normalizeCityName(c.nome))
            );
            if (cidadeParcial) {
              cidadeParaPreencher = cidadeParcial.nome;
            }
          }

          let cidadesFinal = cidadesSorted;
          if (!cidadeParaPreencher && cidadeDoCep) {
            const jaExiste = cidadesSorted.some((c) => normalizeCityName(c.nome) === normalizeCityName(cidadeDoCep));
            if (!jaExiste) {
              cidadesFinal = [
                ...cidadesSorted,
                { codigo_ibge: `cep:${cepLimpo}`, nome: cidadeDoCep },
              ].sort((a, b) => a.nome.localeCompare(b.nome));
            }
            cidadeParaPreencher = cidadeDoCep;
          }

          // Define tudo de uma vez: estado, cidades e cidade
          // Primeiro seta o estado e as cidades, depois preenche a cidade
          setHasAutoFilledFromCep(true);
          setState(dados.state);
          setCidades(cidadesFinal);

          // Preenche a cidade imediatamente após definir as cidades
          // Usa um pequeno delay para garantir que o React atualize o estado do Select
          if (cidadeParaPreencher) {
            // Sempre preenche a cidade, já que ela está na lista (ou foi adicionada como fallback)
            // Usa setTimeout para garantir que o Select reconheça o valor após o estado ser atualizado
            setTimeout(() => {
              setCity(cidadeParaPreencher);
              setPendingCityFromCep('');
            }, 150);
          }

          return { ok: true, state: dados.state, city: cidadeParaPreencher };
        }

        if (!silent) {
          toast({
            variant: 'destructive',
            title: 'CEP invalido',
            description: 'CEP nao encontrado. Verifique o CEP digitado e tente novamente.',
          });
          setCep('');
        }
        setCity('');
        setState('');
        setCidades([]);
        setPendingCityFromCep('');
        return { ok: false };
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        if (!silent) {
          toast({
            variant: 'destructive',
            title: 'Falha na busca de endereco',
            description: 'Nao foi possivel buscar o endereco. Verifique o CEP e tente novamente.',
          });
        }
        return { ok: false };
      } finally {
        setLoadingCep(false);
      }
    } else if (!silent && cepLimpo.length > 0) {
      toast({
        variant: 'destructive',
        title: 'CEP invalido',
        description: 'CEP deve conter 8 digitos.',
      });
    }
    return { ok: false };
  };

  useEffect(() => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (loadingCep) return;
    if (cepLimpo.length !== 8) {
      setHasAutoFilledFromCep(false);
      setPendingCityFromCep('');
      return;
    }
    if (hasAutoFilledFromCep) return;

    const t = setTimeout(() => {
      lookupCep({ silent: true });
    }, 150);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep, loadingCep, hasAutoFilledFromCep]);

  const handleCepBlur = async () => {
    await lookupCep({ silent: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cepLimpo = cep.replace(/\D/g, '');
    let resolvedCity = city;
    let resolvedState = state;

    if ((!resolvedCity || !resolvedState) && cepLimpo.length === 8 && !loadingCep) {
      const res = await lookupCep({ silent: true });
      if (res.ok) {
        resolvedCity = res.city || resolvedCity;
        resolvedState = res.state || resolvedState;
      }
    }

    if (!resolvedCity || !resolvedState) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatorios',
        description: 'Por favor, preencha a cidade e o estado',
      });
      return;
    }

    const monthlyIncomeCents = monthlyIncome ? parseCurrencyToCents(monthlyIncome) : null;

    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Usuario nao autenticado');
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          city: resolvedCity,
          state: resolvedState,
          cep: cep || null,
          birth_date: birthDate ? birthDate.toISOString().split('T')[0] : null,
          gender: gender || null,
          monthly_income_cents: monthlyIncomeCents || null,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      const { error: setupError } = await supabase.rpc('setup_new_user', {
        p_user_id: user.id,
      });

      if (setupError) {
        console.error('Erro ao configurar novo usuario:', setupError);
      }

      toast({
        title: 'Perfil completado!',
        description: 'Seu perfil foi atualizado com sucesso.',
      });

      window.dispatchEvent(new Event('profile-updated'));
      onCompleted?.();

      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao completar perfil',
        description: error.message || 'Nao foi possivel completar seu perfil. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <>
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold mb-2">Complete seu perfil</h1>
        <p className="text-muted-foreground text-sm">
          Precisamos de algumas informacoes adicionais para personalizar sua experiencia
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium mb-2">
              Nome Completo <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              placeholder="Seu nome"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="email_form" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              id="email_form"
              value={email}
              className="w-full px-4 py-3 rounded-xl bg-muted/10 border border-border text-muted-foreground cursor-not-allowed"
              placeholder="seu@email.com"
              disabled
            />
            <p className="text-[10px] text-muted-foreground mt-1">O email não pode ser alterado aqui.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="cep" className="block text-sm font-medium mb-2">
              CEP (opcional)
            </label>
            <input
              type="text"
              id="cep"
              value={cep}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 8) {
                  setCep(value);
                  setHasAutoFilledFromCep(false);
                }
              }}
              onBlur={handleCepBlur}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors text-sm"
              placeholder="00000-000"
              disabled={loading || loadingCep}
              maxLength={8}
            />
          </div>

          <div>
            <label htmlFor="state" className="block text-sm font-medium mb-2">
              Estado <span className="text-destructive">*</span>
            </label>
            <Select
              value={state}
              onValueChange={(value) => {
                setHasAutoFilledFromCep(false);
                setState(value);
              }}
              disabled={loading || loadingCep}
              required
            >
              <SelectTrigger className="w-full px-4 py-3 h-auto rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors text-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {estados.map((estado) => (
                  <SelectItem key={estado.sigla} value={estado.sigla}>
                    {estado.sigla}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium mb-2">
              Cidade <span className="text-destructive">*</span>
            </label>
            <Select
              value={city}
              onValueChange={setCity}
              disabled={loading || loadingCep || !state}
              required
            >
              <SelectTrigger className="w-full px-4 py-3 h-auto rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors text-sm">
                <SelectValue placeholder={state ? 'Cidade' : '...'} />
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Data de Nascimento</label>
            <DatePicker
              date={birthDate}
              setDate={setBirthDate}
              placeholder="Sua data"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Gênero</label>
            <Select
              value={gender}
              onValueChange={setGender}
              disabled={loading}
            >
              <SelectTrigger className="w-full px-4 py-3 h-auto rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors text-sm">
                <SelectValue placeholder="Selecione" />
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
        </div>

        <div>
          <label htmlFor="monthlyIncome" className="block text-sm font-medium mb-2">
            Renda Media Mensal (opcional)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none select-none">
              R$
            </span>
            <input
              type="text"
              id="monthlyIncome"
              value={monthlyIncome}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d,.-]/g, '');
                setMonthlyIncome(raw);
              }}
              onBlur={(e) => {
                if (e.target.value) {
                  const formatted = processCurrencyInput(e.target.value);
                  setMonthlyIncome(formatted);
                }
              }}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              placeholder="0,00"
              disabled={loading}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Se informado, criaremos automaticamente um objetivo de Reserva de Emergencia
          </p>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Salvando...' : 'Completar perfil'}
        </button>
      </form>
    </>
  );

  if (!useCard) {
    return <div className={cn(className)}>{content}</div>;
  }

  return (
    <div className={cn('glass-card p-8', className)}>
      {content}
    </div>
  );
}
