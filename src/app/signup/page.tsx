'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/client';
import { useLogo } from '@/hooks/useLogo';
import Image from 'next/image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
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

function SignupPageContent() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [cep, setCep] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [gender, setGender] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [hasAutoFilledFromCep, setHasAutoFilledFromCep] = useState(false);
  const [pendingCityFromCep, setPendingCityFromCep] = useState<string>('');
  const inviteToken = searchParams?.get('invite');
  const logo = useLogo();
  const isPasswordMismatch =
    password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;

  // Validação de senha
  const passwordRequirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);

  // If user already has a session, don't force them through signup.
  // Redirect to accept page (existing user flow).
  useEffect(() => {
    if (!inviteToken) return;
    try {
      localStorage.setItem('c2f_pending_invite_token', inviteToken);
    } catch {
      // ignore
    }

    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user) {
          router.replace(`/app/sharing/accept?token=${encodeURIComponent(inviteToken)}`);
        }
      })
      .catch(() => {
        // ignore
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken]);

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

  // Carregar cidades quando o estado for selecionado manualmente (não pelo CEP)
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
        // Limpar cidade se não existir na nova lista de cidades
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

  // Função para normalizar nome de cidade (remove acentos, converte para minúsculas)
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
          // Primeiro, carrega as cidades do estado retornado
          const cidadesData = await buscarCidadesPorEstado(dados.state);
          const cidadeDoCep = (dados.city || '').trim();
          const cidadesSorted = cidadesData.sort((a, b) => a.nome.localeCompare(b.nome));

          // Tenta encontrar a cidade que corresponde ao nome retornado pela API
          const cidadeEncontrada = cidadesSorted.find(
            (c) => normalizeCityName(c.nome) === normalizeCityName(cidadeDoCep)
          );

          let cidadeParaPreencher = '';
          if (cidadeEncontrada) {
            cidadeParaPreencher = cidadeEncontrada.nome;
          } else {
            // Se não encontrar exato, tenta encontrar por contém
            const cidadeParcial = cidadesSorted.find(
              (c) => normalizeCityName(c.nome).includes(normalizeCityName(cidadeDoCep)) ||
                normalizeCityName(cidadeDoCep).includes(normalizeCityName(c.nome))
            );
            if (cidadeParcial) {
              cidadeParaPreencher = cidadeParcial.nome;
            }
          }

          // Importante: o Select só mostra valores que existam nas opções.
          // Se a cidade do CEP não existir na lista (variação de nome), adiciona como fallback.
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
        } else {
          // CEP não encontrado ou inválido
          if (!silent) {
            toast({
              variant: 'destructive',
              title: 'CEP inválido',
              description: 'CEP não encontrado. Verifique o CEP digitado e tente novamente.',
            });
            setCep(''); // Limpa o campo CEP
          }
          setCity('');
          setState('');
          setCidades([]);
          setPendingCityFromCep('');
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

  // Preencher automaticamente assim que o CEP ficar completo (sem depender de blur)
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

  // Buscar CEP quando o usuário terminar de digitar
  const handleCepBlur = async () => {
    await lookupCep({ silent: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Se o usuário digitou CEP completo e ainda não tem cidade/estado, tenta auto-preencher antes de bloquear o submit
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

    if (isPasswordMismatch) {
      return;
    }

    if (!acceptedTerms) {
      toast({
        variant: "destructive",
        title: "Aceite dos termos obrigatório",
        description: "Você precisa aceitar os termos de uso e política de privacidade para continuar",
      });
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      // Convert monthly income to cents
      const monthlyIncomeCents = parseCurrencyToCents(monthlyIncome);
      
      let origin = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      if (origin.includes('0.0.0.0')) {
        origin = origin.replace('0.0.0.0', 'localhost');
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/confirm`,
          data: {
            full_name: name,
            city: resolvedCity,
            state: resolvedState,
            cep: cep || null,
            birth_date: birthDate ? birthDate.toISOString().split('T')[0] : null,
            gender: gender || null,
            monthly_income_cents: monthlyIncomeCents,
          },
        },
      });

      if (error) throw error;

      if (!signUpData.session) {
        toast({
          title: 'Verifique seu email',
          description: 'Enviamos um link de confirmação para ativar sua conta.',
        });
        router.push('/auth/check-email');
        router.refresh();
        return;
      }

      // If this signup came from an invite link, accept the invite after signup.
      if (inviteToken) {
        try {
          const { data: userAfterSignup } = await supabase.auth.getUser();
          if (userAfterSignup.user) {
            const acceptRes = await fetch('/api/sharing/accept', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: inviteToken }),
            });
            if (!acceptRes.ok) {
              const acceptData = await acceptRes.json().catch(() => ({}));
              console.error('[Signup] Failed to accept invite:', acceptData);
            }
          } else {
            // If no session (email confirmation flow), keep the token so we can accept later after login.
            localStorage.setItem('c2f_pending_invite_token', inviteToken);
          }
        } catch (inviteErr) {
          console.error('[Signup] Invite acceptance error:', inviteErr);
        }
      }

      // Wait for profile to be created by trigger
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update profile with monthly income if user was created
      if (signUpData.user) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ monthly_income_cents: monthlyIncomeCents })
          .eq('id', signUpData.user.id);

        if (updateError) {
          console.error('Error updating monthly income:', updateError);
          // Don't throw, continue with signup
        } else {
          // Call setup_new_user to create emergency fund goal
          await supabase.rpc('setup_new_user', { p_user_id: signUpData.user.id });
        }
      }

      router.push('/app');
      router.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Falha na criação de conta",
        description: error.message || "Não foi possível criar sua conta. Verifique os dados e tente novamente.",
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
        <Link href="/" className="flex items-center justify-center mb-8">
          <Image
            src={logo}
            alt="c2Finance"
            width={120}
            height={40}
            className="h-8 md:h-10 w-auto"
            style={{ objectFit: 'contain' }}
            priority
          />
        </Link>

        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold mb-2">Crie sua conta</h1>
            <p className="text-muted-foreground text-sm">Comece a controlar suas finanças hoje</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Nome
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                placeholder="Seu nome"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                placeholder="seu@email.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  placeholder="Mínimo 8 caracteres"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPasswords ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className={`flex items-center gap-2 text-xs ${passwordRequirements.minLength ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                    <i className={`bx ${passwordRequirements.minLength ? 'bx-check-circle' : 'bx-circle'} text-sm`} />
                    <span>Mínimo 8 caracteres</span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${passwordRequirements.hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                    <i className={`bx ${passwordRequirements.hasUppercase ? 'bx-check-circle' : 'bx-circle'} text-sm`} />
                    <span>Pelo menos 1 letra maiúscula</span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${passwordRequirements.hasLowercase ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                    <i className={`bx ${passwordRequirements.hasLowercase ? 'bx-check-circle' : 'bx-circle'} text-sm`} />
                    <span>Pelo menos 1 letra minúscula</span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${passwordRequirements.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                    <i className={`bx ${passwordRequirements.hasNumber ? 'bx-check-circle' : 'bx-circle'} text-sm`} />
                    <span>Pelo menos 1 número</span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${passwordRequirements.hasSpecial ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                    <i className={`bx ${passwordRequirements.hasSpecial ? 'bx-check-circle' : 'bx-circle'} text-sm`} />
                    <span>Pelo menos 1 caractere especial (!@#$%^&*)</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                Confirmar Senha
              </label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  placeholder="Digite a senha novamente"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPasswords ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {isPasswordMismatch && (
                <p className="text-xs text-destructive mt-2">
                  As senhas não coincidem.
                </p>
              )}
            </div>

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
              <Select
                value={state}
                onValueChange={(value) => {
                  setHasAutoFilledFromCep(false);
                  setState(value);
                }}
                disabled={loading || loadingCep}
                required
              >
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
                    // Digitação livre: NÃO formatar aqui (isso trava o cursor).
                    // Formatação acontece apenas no blur.
                    const raw = e.target.value.replace(/[^\d,.-]/g, '');
                    setMonthlyIncome(raw);
                  }}
                  onBlur={(e) => {
                    // Garante formatação completa ao perder o foco
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

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                disabled={loading}
                className="mt-1"
              />
              <label
                htmlFor="terms"
                className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
              >
                Li e concordo com os{' '}
                <Link
                  href="/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Termos de Uso
                </Link>{' '}
                e{' '}
                <Link
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Política de Privacidade
                </Link>
              </label>
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading || !acceptedTerms || isPasswordMismatch || !isPasswordValid}
            >
              <i className='bx bx-rocket'></i>
              {loading ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Já tem uma conta?{' '}
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}&next=${encodeURIComponent(
                      `/app/sharing/accept?token=${inviteToken}`
                    )}`
                  : '/login'
              }
              className="text-primary hover:underline font-medium"
            >
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <i className="bx bx-loader-alt bx-spin" />
          Carregando...
        </div>
      </div>
    }>
      <SignupPageContent />
    </Suspense>
  );
}





