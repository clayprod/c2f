import { NextRequest, NextResponse } from 'next/server';
import { fetchBrand } from '@/services/brandfetch/client';
import { extractPrimaryColor } from '@/services/brandfetch/normalize';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawIdentifier = (searchParams.get('domain') || searchParams.get('identifier') || '').trim();

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

    const identifier = normalizeDomain(rawIdentifier);

    if (!identifier) {
      return NextResponse.json({ error: 'Missing domain' }, { status: 400 });
    }

    const brand = await fetchBrand(identifier);
    const primaryColor = extractPrimaryColor(brand);

    return NextResponse.json({
      name: brand?.name || brand?.brand?.name || identifier,
      domain: brand?.domain || brand?.brand?.domain || identifier,
      brandId: brand?.id || brand?.brand?.id || null,
      primaryColor,
      colors: brand?.colors || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Brandfetch brand lookup failed' },
      { status: 500 }
    );
  }
}
