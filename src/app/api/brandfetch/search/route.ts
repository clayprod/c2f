import { NextRequest, NextResponse } from 'next/server';
import { searchBrands } from '@/services/brandfetch/client';
import { fetchBrand } from '@/services/brandfetch/client';

const normalizeDomain = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const withScheme = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    return url.hostname.replace(/^www\./i, '');
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '');
  }
};

const normalizeList = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item: any) => normalizeList(item));
  }
  if (typeof value === 'object') {
    const candidates = [
      value.name,
      value.title,
      value.slug,
      value.value,
      value.category,
      value.industry,
      value.label,
    ].filter(Boolean);
    return candidates.flatMap((item: any) => normalizeList(item));
  }
  return String(value || '')
    .split(/[,;/]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const isFinanceResult = (result: any) => {

  const fields = [
    ...normalizeList(result?.category),
    ...normalizeList(result?.categories),
    ...normalizeList(result?.industry),
    ...normalizeList(result?.industries),
    ...normalizeList(result?.tags),
    ...normalizeList(result?.company?.industry),
    ...normalizeList(result?.company?.categories),
    ...normalizeList(result?.metadata?.category),
    ...normalizeList(result?.metadata?.industry),
  ];

  const financeKeywords = [
    'finance',
    'financial',
    'bank',
    'banking',
    'credit',
    'card',
    'payments',
    'payment',
    'fintech',
    'insurance',
    'investment',
    'investments',
    'lending',
    'loan',
    'loans',
  ];

  return fields.some((field) => financeKeywords.some((keyword) => field.includes(keyword)));
};

const isFinanceBrand = (brand: any) => {
  if (!brand) return false;

  const fields = [
    ...normalizeList(brand?.category),
    ...normalizeList(brand?.categories),
    ...normalizeList(brand?.industry),
    ...normalizeList(brand?.industries),
    ...normalizeList(brand?.tags),
    ...normalizeList(brand?.metadata?.category),
    ...normalizeList(brand?.metadata?.industry),
    ...normalizeList(brand?.company?.industry),
    ...normalizeList(brand?.company?.categories),
  ];

  const financeKeywords = [
    'finance',
    'financial',
    'bank',
    'banking',
    'credit',
    'card',
    'payments',
    'payment',
    'fintech',
    'insurance',
    'investment',
    'investments',
    'lending',
    'loan',
    'loans',
  ];

  return fields.some((field) => financeKeywords.some((keyword) => field.includes(keyword)));
};

const normalizeResult = (result: any) => {
  const name =
    result?.name ||
    result?.brand_name ||
    result?.brand?.name ||
    result?.company?.name ||
    result?.domain ||
    result?.website ||
    '';
  const domainRaw =
    result?.domain ||
    result?.brand?.domain ||
    result?.website ||
    result?.url ||
    '';
  const domain = normalizeDomain(String(domainRaw || ''));
  const brandId =
    result?.brandId ||
    result?.id ||
    result?.brand?.id ||
    result?.brand_id ||
    '';

  return {
    name: String(name || '').trim(),
    domain: String(domain || '').trim(),
    brandId: String(brandId || '').trim() || null,
  };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('query') || '').trim();

    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const data = await searchBrands(query);
    const rawResults = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : [];

    const normalizedResults = rawResults
      .map((raw: any) => ({ raw, ...normalizeResult(raw) }))
      .filter((item: { name?: string; domain?: string }) => item.name || item.domain);

    const prefiltered = normalizedResults.filter((item: { raw: any }) => isFinanceResult(item.raw));
    const baseResults = prefiltered.length > 0 ? prefiltered : normalizedResults;

    const candidates = baseResults
      .filter((item: { domain?: string }) => item.domain)
      .slice(0, 8);
    const branded = await Promise.all(
      candidates.map(async (item: { name: string; domain: string; brandId?: string | null; raw?: any }) => {
        try {
          const brand = await fetchBrand(item.domain);
          if (!isFinanceBrand(brand)) return null;
          return {
            name: brand?.name || item.name,
            domain: brand?.domain || item.domain,
            brandId: brand?.id || item.brandId || null,
          };
        } catch {
          if (item.raw && isFinanceResult(item.raw)) {
            return {
              name: item.name,
              domain: item.domain,
              brandId: item.brandId || null,
            };
          }
          return null;
        }
      })
    );

    const results = branded.filter(Boolean) as Array<{ name: string; domain: string; brandId: string | null }>;

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Brandfetch search failed', results: [] },
      { status: 500 }
    );
  }
}
