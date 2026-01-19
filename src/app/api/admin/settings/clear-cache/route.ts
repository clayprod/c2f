import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { clearSettingsCache } from '@/services/admin/globalSettings';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    clearSettingsCache();
    return NextResponse.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
