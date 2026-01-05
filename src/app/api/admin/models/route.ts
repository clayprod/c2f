import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getModelsForProvider, clearModelsCache } from '@/services/advisor/models';
import { getGlobalSettings } from '@/services/admin/globalSettings';

/**
 * GET /api/admin/models?provider=groq|openai
 * Fetch available models for a provider
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as 'groq' | 'openai' || 'groq';
    const refresh = searchParams.get('refresh') === 'true';

    // Clear cache if refresh requested
    if (refresh) {
      clearModelsCache();
    }

    // Get API key from settings or env
    const settings = await getGlobalSettings();
    const apiKey = provider === 'groq'
      ? settings.groq_api_key || process.env.GROQ_API_KEY
      : settings.openai_api_key || process.env.OPENAI_API_KEY;

    const models = await getModelsForProvider(provider, apiKey || undefined);

    return NextResponse.json({ models, provider });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
