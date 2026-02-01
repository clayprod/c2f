const BRAND_FETCH_API_BASE = 'https://api.brandfetch.io/v2';
const BRAND_FETCH_LOGO_BASE = 'https://cdn.brandfetch.io';

export type BrandfetchLogoOptions = {
  identifier: string;
  type?: 'icon' | 'logo' | 'symbol';
  theme?: 'light' | 'dark';
  size?: number;
  fallback?: 'brandfetch' | 'transparent' | 'lettermark' | '404';
};

const getClientId = () =>
  process.env.BRANDFETCH_CLIENT_ID?.trim() ||
  process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID?.trim();
const getApiKey = () => process.env.BRANDFETCH_API_KEY?.trim();

const encodeIdentifier = (identifier: string) =>
  identifier
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

export const buildBrandfetchLogoUrl = (options: BrandfetchLogoOptions) => {
  const clientId = getClientId();
  if (!clientId) return null;

  const identifier = encodeIdentifier(options.identifier);
  const type = options.type ?? 'icon';
  const theme = options.theme ?? 'dark';
  const size = options.size ?? 64;
  const fallback = options.fallback ?? 'lettermark';

  return `${BRAND_FETCH_LOGO_BASE}/${identifier}/w/${size}/h/${size}/theme/${theme}/fallback/${fallback}/type/${type}?c=${clientId}`;
};

export const searchBrands = async (query: string) => {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Brandfetch client ID not configured');
  }

  const url = `${BRAND_FETCH_API_BASE}/search/${encodeURIComponent(query)}?c=${clientId}`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Brandfetch search failed: ${response.status}`);
  }
  return response.json();
};

export const fetchBrand = async (identifier: string) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Brandfetch API key not configured');
  }

  const url = `${BRAND_FETCH_API_BASE}/brands/${encodeURIComponent(identifier)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Brandfetch brand lookup failed: ${response.status}`);
  }

  return response.json();
};
