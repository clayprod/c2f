'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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

const GENDER_OPTIONS = [
  { label: 'Homem (Cisgênero)', value: 'male_cis' },
  { label: 'Homem (Transgênero)', value: 'male_trans' },
  { label: 'Mulher (Cisgênero)', value: 'female_cis' },
  { label: 'Mulher (Transgênero)', value: 'female_trans' },
  { label: 'Não Binário', value: 'non_binary' },
  { label: 'Outro', value: 'other' },
  { label: 'Prefiro não responder', value: 'prefer_not_to_say' },
] as const;

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cep, setCep] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const router = useRouter();
  const { toast } = useToast();

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
  }, [state]);

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
          setState(dados.state);
          setCity(cidadeParaPreencher);
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
          title: 'Falha na busca de endereço',
          description: 'Não foi possível buscar o endereço. Verifique o CEP e tente novamente.',
        });
      } finally {
        setLoadingCep(false);
      }
    } else if (cepLimpo.length > 0) {
      toast({
        variant: 'destructive',
        title: 'CEP inválido',
        description: 'CEP deve conter 8 dígitos.',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!city || !state) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Por favor, preencha a cidade e o estado",
      });
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            city,
            state,
            birth_date: birthDate ? birthDate.toISOString().split('T')[0] : null,
            gender: gender || null,
          },
        },
      });

      if (error) throw error;

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
            src={getLogo('auto')}
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
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                placeholder="Mínimo 8 caracteres"
                required
                disabled={loading}
              />
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

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <i className='bx bx-rocket'></i>
              {loading ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Já tem uma conta?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Entrar
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Ao criar sua conta, você concorda com nossos{' '}
          <a href="#" className="text-primary hover:underline">
            Termos de Uso
          </a>{' '}
          e{' '}
          <a href="#" className="text-primary hover:underline">
            Política de Privacidade
          </a>
        </p>
      </div>
    </div>
  );
}





