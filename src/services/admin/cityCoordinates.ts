/**
 * City Coordinates Service
 * Busca coordenadas de cidades brasileiras usando a Brasil API
 */

interface CityCoordinates {
  lat: number;
  lng: number;
}

interface BrasilApiCity {
  codigo_ibge: string;
  nome: string;
  latitude?: number;
  longitude?: number;
}

// Cache simples em memória para evitar múltiplas requisições
const coordinatesCache = new Map<string, CityCoordinates | null>();

/**
 * Coordenadas aproximadas dos centros dos estados brasileiros
 * Usado como fallback quando não encontramos a cidade específica
 */
const STATE_CENTERS: Record<string, CityCoordinates> = {
  AC: { lat: -9.0238, lng: -70.8120 },
  AL: { lat: -9.5713, lng: -36.7820 },
  AP: { lat: 1.4144, lng: -51.7860 },
  AM: { lat: -4.2633, lng: -65.9040 },
  BA: { lat: -12.9714, lng: -38.5014 },
  CE: { lat: -5.4984, lng: -39.3206 },
  DF: { lat: -15.7942, lng: -47.8822 },
  ES: { lat: -19.1834, lng: -40.3089 },
  GO: { lat: -16.6864, lng: -49.2643 },
  MA: { lat: -2.5387, lng: -44.2825 },
  MT: { lat: -15.6014, lng: -56.0979 },
  MS: { lat: -20.7722, lng: -54.7852 },
  MG: { lat: -19.9167, lng: -43.9345 },
  PA: { lat: -1.4558, lng: -48.5044 },
  PB: { lat: -7.2400, lng: -36.7820 },
  PR: { lat: -25.4284, lng: -49.2733 },
  PE: { lat: -8.0476, lng: -34.8770 },
  PI: { lat: -5.0892, lng: -42.8019 },
  RJ: { lat: -22.9068, lng: -43.1729 },
  RN: { lat: -5.7945, lng: -35.2110 },
  RS: { lat: -30.0346, lng: -51.2177 },
  RO: { lat: -8.7619, lng: -63.9039 },
  RR: { lat: 1.4144, lng: -61.4440 },
  SC: { lat: -27.2423, lng: -50.2189 },
  SP: { lat: -23.5505, lng: -46.6333 },
  SE: { lat: -10.5741, lng: -37.3853 },
  TO: { lat: -10.1753, lng: -48.2982 },
};

/**
 * Busca coordenadas de uma cidade usando a Brasil API
 * Tenta buscar por nome da cidade e estado
 */
export async function getCityCoordinates(
  cityName: string,
  stateCode: string
): Promise<CityCoordinates | null> {
  const cacheKey = `${cityName}-${stateCode}`.toLowerCase();
  
  // Verificar cache
  if (coordinatesCache.has(cacheKey)) {
    return coordinatesCache.get(cacheKey) || null;
  }

  try {
    // Normalizar nome da cidade (remover acentos e converter para minúsculas)
    const normalizedCity = cityName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    const stateUpper = stateCode.toUpperCase().trim();

    // Buscar cidades do estado
    const response = await fetch(
      `https://brasilapi.com.br/api/ibge/municipios/v1/${stateUpper}`
    );

    if (!response.ok) {
      console.warn(`Erro ao buscar cidades do estado ${stateUpper}:`, response.statusText);
      // Usar coordenadas do centro do estado como fallback
      const stateCenter = STATE_CENTERS[stateUpper];
      if (stateCenter) {
        coordinatesCache.set(cacheKey, stateCenter);
        return stateCenter;
      }
      return null;
    }

    const cities: BrasilApiCity[] = await response.json();

    // Buscar cidade correspondente (tentativa de match flexível)
    let foundCity = cities.find((c) => {
      const normalizedC = c.nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
      
      return normalizedC === normalizedCity || 
             normalizedC.includes(normalizedCity) ||
             normalizedCity.includes(normalizedC);
    });

    // Se não encontrou match exato, tentar buscar por IBGE para obter coordenadas
    if (foundCity && foundCity.codigo_ibge) {
      try {
        // Tentar buscar detalhes do município na API do IBGE
        const ibgeResponse = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${foundCity.codigo_ibge}`
        );
        
        if (ibgeResponse.ok) {
          const ibgeData = await ibgeResponse.json();
          if (ibgeData.latitude && ibgeData.longitude) {
            const coords = {
              lat: parseFloat(ibgeData.latitude),
              lng: parseFloat(ibgeData.longitude),
            };
            coordinatesCache.set(cacheKey, coords);
            return coords;
          }
        }
      } catch (ibgeError) {
        console.warn('Erro ao buscar coordenadas do IBGE:', ibgeError);
      }
    }

    // Se não encontrou coordenadas específicas, usar centro do estado
    const stateCenter = STATE_CENTERS[stateUpper];
    if (stateCenter) {
      coordinatesCache.set(cacheKey, stateCenter);
      return stateCenter;
    }

    coordinatesCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.error(`Erro ao buscar coordenadas de ${cityName}, ${stateCode}:`, error);
    
    // Fallback para centro do estado
    const stateCenter = STATE_CENTERS[stateCode.toUpperCase()];
    if (stateCenter) {
      coordinatesCache.set(cacheKey, stateCenter);
      return stateCenter;
    }
    
    coordinatesCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Busca coordenadas para múltiplas cidades em paralelo
 */
export async function getMultipleCityCoordinates(
  cities: Array<{ city: string; state: string }>
): Promise<Map<string, CityCoordinates | null>> {
  const results = new Map<string, CityCoordinates | null>();
  
  // Processar em paralelo (limitado a 10 requisições simultâneas para não sobrecarregar)
  const batchSize = 10;
  for (let i = 0; i < cities.length; i += batchSize) {
    const batch = cities.slice(i, i + batchSize);
    const promises = batch.map(async ({ city, state }) => {
      const coords = await getCityCoordinates(city, state);
      return { city, state, coords };
    });
    
    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ city, state, coords }) => {
      const key = `${city}-${state}`.toLowerCase();
      results.set(key, coords);
    });
  }
  
  return results;
}
