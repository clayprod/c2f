'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  { label: 'Nao-binario', value: 'non_binary' },
  { label: 'Outro', value: 'other' },
  { label: 'Prefiro nao responder', value: 'prefer_not_to_say' },
] as const;

interface CompleteProfileDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function CompleteProfileDialog({ open, onComplete }: CompleteProfileDialogProps) {
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
  const [hasAutoFilledFromCep, setHasAutoFilledFromCep] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Carregar estados ao montar o componente
  useEffect(() => {
    if (!open) return;

    async function loadEstados() {
      try {
        const estadosData = await buscarEstados();
        setEstados(estadosData.sort((a, b) => a.nome.localeCompare(b.nome)));
      } catch (error) {
        console.error('Erro ao carregar estados:', error);
      }
    }
    loadEstados();
  }, [open]);

  // Carregar cidades quando o estado for selecionado manualmente (não pelo CEP)
  useEffect(() => {
    async function loadCidades() {
      if (!state) {
        setCidades([]);
        setCity('');
        return;
      }

      // Se o estado foi preenchido pelo CEP, não recarregar as cidades
      // pois o lookupCep já fez isso e pode ter adicionado cidade como fallback
      if (hasAutoFilledFromCep) {
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
  }, [state, hasAutoFilledFromCep]);

  // Funcao para normalizar nome de cidade
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
              title: 'CEP invalido',
              description: 'CEP nao encontrado. Verifique o CEP digitado e tente novamente.',
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
        title: "Campos obrigatorios",
        description: "Por favor, preencha a cidade e o estado",
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
          city: resolvedCity,
          state: resolvedState,
          cep: cep || null,
          birth_date: birthDate ? birthDate.toISOString().split('T')[0] : null,
          gender: gender || null,
          monthly_income_cents: monthlyIncomeCents || null,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Chamar setup_new_user para criar objetivo de emergencia
      const { error: setupError } = await supabase.rpc('setup_new_user', {
        p_user_id: user.id,
      });

      if (setupError) {
        console.error('Erro ao configurar novo usuario:', setupError);
        // Nao bloquear o fluxo se isso falhar
      }

      toast({
        title: "Perfil completado!",
        description: "Seu perfil foi atualizado com sucesso.",
      });

      onComplete();
      router.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao completar perfil",
        description: error.message || "Nao foi possivel completar seu perfil. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Complete seu perfil</DialogTitle>
          <DialogDescription>
            Precisamos de algumas informacoes adicionais para personalizar sua experiencia
          </DialogDescription>
        </DialogHeader>

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
              <p className="text-xs text-muted-foreground mt-1">Buscando endereco...</p>
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
            <label className="block text-sm font-medium mb-2">Genero</label>
            <Select
              value={gender}
              onValueChange={setGender}
              disabled={loading}
            >
              <SelectTrigger className="w-full px-4 py-3 h-auto rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors">
                <SelectValue placeholder="Selecione o genero" />
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
      </DialogContent>
    </Dialog>
  );
}
