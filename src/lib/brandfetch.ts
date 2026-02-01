export type BrandfetchLogoTheme = 'light' | 'dark';
export type BrandfetchLogoType = 'icon' | 'logo' | 'symbol';

export const buildBrandfetchLogoProxyUrl = (options: {
  identifier: string;
  size?: number;
  theme?: BrandfetchLogoTheme;
  type?: BrandfetchLogoType;
}) => {
  const params = new URLSearchParams();
  params.set('identifier', options.identifier);
  if (options.size) params.set('size', String(options.size));
  if (options.theme) params.set('theme', options.theme);
  if (options.type) params.set('type', options.type);
  return `/api/brandfetch/logo?${params.toString()}`;
};

export const getCardBrandDomain = (brand?: string | null) => {
  switch ((brand || '').toLowerCase()) {
    case 'visa':
      return 'domain/visa.com';
    case 'mastercard':
      return 'domain/mastercard.com';
    case 'amex':
      return 'domain/americanexpress.com';
    case 'elo':
      return 'domain/elo.com.br';
    case 'hipercard':
      return 'domain/hipercard.com.br';
    case 'diners':
      return 'domain/dinersclub.com';
    default:
      return null;
  }
};
