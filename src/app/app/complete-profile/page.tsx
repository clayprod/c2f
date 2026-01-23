'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getLogo } from '@/lib/logo';
import Image from 'next/image';
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
import { processCurrencyInput, parseCurrencyToCents } from '@/lib/utils';

const GENDER_OPTIONS = [
  { label: 'Homem', value: 'male_cis' },
  { label: 'Mulher', value: 'female_cis' },
  { label: 'Não-binário', value: 'non_binary' },
  { label: 'Outro', value: 'other' },
  { label: 'Prefiro não responder', value: 'prefer_not_to_say' },
] as const;

export default function CompleteProfilePage() {
  const [cep, setCep] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [gender, setGender] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const router = useRouter();
  const { toast } = useToast();
  const [hasAutoFilledFromCep, setHasAutoFilledFromCep] = useState(false);

  // Verificar se usuário está autenticado
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Verificar se perfil já está completo
      const { data: profile } = await supabase
        .from('profiles')
        .select('city, state, monthly_income_cents')
        .eq('id', user.id)
        .single();

      if (profile && profile.city && profile.state && profile.monthly_income_cents) {
        router.push('/app');
      }
    };

    checkAuth();
  }, [router]);

  // Carregar estados ao montar o componente
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

  // Carregar cidades quando o estado for selecionado
  useEffect(() => {
    async function loadCidades() {
      if (!state) {
        setCidades([]);
        setCity('');
        return;
      }

      try {
        const cidadesData = await buscarCidadesPorEstado(state);
        setCidades(cidadesData.sort((a, b) => a.nome.localeCompare(b.nome)));
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
  }, [state]);

  // Função para normalizar nome de cidade
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

          setCidades(cidadesFinal);
          setState(dados.state);
          setCity(cidadeParaPreencher);
          setHasAutoFilledFromCep(true);
          return { ok: true, state: dados.state, city: cidadeParaPreencher };
        } else {
          if (!silent) {
            toast({
              variant: 'destructive',
              title: 'CEP inválido',
              description: 'CEP não encontrado. Verifique o CEP digitado e tente novamente.',
            });
            setCep('');
          }
          setCity('');
          setState('');
          setCidades([]);
          return { ok: false };
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        if (!silent) {
          toast({
            variant: 'destructive',
            title: 'Falha na busca de endereço',
            description: 'Não foi possível buscar o endereço. Verifique o CEP e tente novamente.',
          });
        }
        return { ok: false };
      } finally {
        setLoadingCep(false);
      }
    } else if (!silent && cepLimpo.length > 0) {
      toast({
        variant: 'destructive',
        title: 'CEP inválido',
        description: 'CEP deve conter 8 dígitos.',
      });
    }
    return { ok: false };
  };

  // Preencher automaticamente quando CEP estiver completo
  useEffect(() => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (loadingCep) return;
    if (cepLimpo.length !== 8) {
      setHasAutoFilledFromCep(false);
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
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Por favor, preencha a cidade e o estado",
      });
      return;
    }

    const monthlyIncomeCents = parseCurrencyToCents(monthlyIncome);
    if (!monthlyIncome || monthlyIncomeCents <= 0) {
      toast({
        variant: "destructive",
        title: "Renda mensal obrigatória",
        description: "Por favor, informe sua renda média mensal",
      });
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          city: resolvedCity,
          state: resolvedState,
          cep: cep || null,
          birth_date: birthDate ? birthDate.toISOString().split('T')[0] : null,
          gender: gender || null,
          monthly_income_cents: monthlyIncomeCents,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Chamar setup_new_user para criar objetivo de emergência
      const { error: setupError } = await supabase.rpc('setup_new_user', {
        p_user_id: user.id,
      });

      if (setupError) {
        console.error('Erro ao configurar novo usuário:', setupError);
        // Não bloquear o fluxo se isso falhar
      }

      toast({
        title: "Perfil completado!",
        description: "Seu perfil foi atualizado com sucesso.",
      });

      router.push('/app');
      router.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao completar perfil",
        description: error.message || "Não foi possível completar seu perfil. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex items-center justify-center mb-8">
          <Image
            src={getLogo('auto')}
            alt="c2Finance"
            width={120}
            height={40}
            className="h-8 md:h-10 w-auto"
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>

        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold mb-2">Complete seu perfil</h1>
            <p className="text-muted-foreground text-sm">
              Precisamos de algumas informações adicionais para personalizar sua experiência
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  }
                }}
                onBlur={handleCepBlur}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                placeholder="00000-000"
                disabled={loading || loadingCep}
                maxLength={8}
              />
              {loadingCep && (
                <p className="text-xs text-muted-foreground mt-1">Buscando endereço...</p>
              )}
            </div>

            <div>
              <label htmlFor="state" className="block text-sm font-medium mb-2">
                Estado <span className="text-destructive">*</span>
              </label>
              <Select value={state} onValueChange={setState} disabled={loading || loadingCep} required>
                <SelectTrigger className="w-full px-4 py-3 h-auto rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors">
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
              <label htmlFor="city" className="block text-sm font-medium mb-2">
                Cidade <span className="text-destructive">*</span>
              </label>
              <Select
                value={city}
                onValueChange={setCity}
                disabled={loading || loadingCep || !state}
                required
              >
                <SelectTrigger className="w-full px-4 py-3 h-auto rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors">
                  <SelectValue placeholder={state ? "Selecione a cidade" : "Selecione o estado primeiro"} />
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
              <label className="block text-sm font-medium mb-2">Data de Nascimento</label>
              <DatePicker
                date={birthDate}
                setDate={setBirthDate}
                placeholder="Selecione sua data de nascimento"
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
                <SelectTrigger className="w-full px-4 py-3 h-auto rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors">
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
              <label htmlFor="monthlyIncome" className="block text-sm font-medium mb-2">
                Renda Média Mensal <span className="text-destructive">*</span>
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
                  required
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Com base nisso, criaremos automaticamente um objetivo de Reserva de Emergência
              </p>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Salvando...' : 'Completar perfil'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

