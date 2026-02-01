import { NextRequest, NextResponse } from 'next/server';
import { buildBrandfetchLogoUrl } from '@/services/brandfetch/client';

const allowedTypes = new Set(['icon', 'logo', 'symbol']);
const allowedThemes = new Set(['light', 'dark']);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const identifier = (searchParams.get('identifier') || '').trim();
  const type = (searchParams.get('type') || 'icon').trim();
  const theme = (searchParams.get('theme') || 'dark').trim();
  const sizeParam = searchParams.get('size');
  const size = sizeParam ? Number(sizeParam) : undefined;

  if (!identifier) {
    return NextResponse.json({ error: 'Missing identifier' }, { status: 400 });
  }

  const logoUrl = buildBrandfetchLogoUrl({
    identifier,
    type: allowedTypes.has(type) ? (type as 'icon' | 'logo' | 'symbol') : 'icon',
    theme: allowedThemes.has(theme) ? (theme as 'light' | 'dark') : 'dark',
    size: Number.isFinite(size) && size ? Math.max(16, Math.min(512, size)) : undefined,
  });

  if (!logoUrl) {
    return NextResponse.json({ error: 'Brandfetch client ID not configured' }, { status: 500 });
  }

  return NextResponse.redirect(logoUrl);
}
