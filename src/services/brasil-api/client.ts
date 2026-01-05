/**
 * Brasil API Client
 * Integração com a Brasil API para buscar dados de CEP, estados e cidades
 * https://brasilapi.com.br/
 */

export interface CepResponse {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  service: string;
}

export interface Estado {
  sigla: string;
  nome: string;
  regiao: {
    sigla: string;
    nome: string;
  };
}

export interface Cidade {
  codigo_ibge: string;
  nome: string;
}

const BRASIL_API_BASE_URL = 'https://brasilapi.com.br/api';

/**
 * Busca informações de endereço por CEP
 */
export async function buscarCep(cep: string): Promise<CepResponse | null> {
  try {
    // Remove caracteres não numéricos do CEP
    const cepLimpo = cep.replace(/\D/g, '');
    
    if (cepLimpo.length !== 8) {
      throw new Error('CEP deve conter 8 dígitos');
    }

    const response = await fetch(`${BRASIL_API_BASE_URL}/cep/v1/${cepLimpo}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Erro ao buscar CEP: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar CEP:', error);
    throw error;
  }
}

/**
 * Busca lista de todos os estados do Brasil
 */
export async function buscarEstados(): Promise<Estado[]> {
  try {
    const response = await fetch(`${BRASIL_API_BASE_URL}/ibge/uf/v1`);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar estados: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar estados:', error);
    throw error;
  }
}

/**
 * Busca lista de cidades por estado (UF)
 */
export async function buscarCidadesPorEstado(uf: string): Promise<Cidade[]> {
  try {
    const ufUpper = uf.toUpperCase().trim();
    
    if (ufUpper.length !== 2) {
      throw new Error('UF deve conter 2 caracteres');
    }

    const response = await fetch(`${BRASIL_API_BASE_URL}/ibge/municipios/v1/${ufUpper}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Erro ao buscar cidades: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar cidades:', error);
    throw error;
  }
}

