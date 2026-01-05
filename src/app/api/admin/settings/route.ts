import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getGlobalSettings, updateGlobalSettings, type GlobalSettings } from '@/services/admin/globalSettings';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const settings = await getGlobalSettings();
    
    // Don't expose passwords/keys in response - return masked or omit sensitive fields
    const safeSettings: Partial<GlobalSettings> = {
      ...settings,
      smtp_password: settings.smtp_password ? '***' : null,
      groq_api_key: settings.groq_api_key ? '***' : null,
      openai_api_key: settings.openai_api_key ? '***' : null,
    };

    return NextResponse.json(safeSettings);
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);
    
    const body = await request.json();
    
    // Handle password/key fields: if value is '***', don't update (keep existing)
    const updates: Partial<GlobalSettings> = {};
    
    if (body.smtp_host !== undefined) updates.smtp_host = body.smtp_host;
    if (body.smtp_port !== undefined) updates.smtp_port = body.smtp_port;
    if (body.smtp_user !== undefined) updates.smtp_user = body.smtp_user;
    if (body.smtp_password !== undefined && body.smtp_password !== '***') {
      updates.smtp_password = body.smtp_password;
    }
    if (body.smtp_from_email !== undefined) updates.smtp_from_email = body.smtp_from_email;
    
    if (body.groq_api_key !== undefined && body.groq_api_key !== '***') {
      updates.groq_api_key = body.groq_api_key;
    }
    if (body.openai_api_key !== undefined && body.openai_api_key !== '***') {
      updates.openai_api_key = body.openai_api_key;
    }
    
    if (body.ai_model !== undefined) updates.ai_model = body.ai_model;
    if (body.ai_model_name !== undefined) updates.ai_model_name = body.ai_model_name;
    if (body.advisor_prompt !== undefined) updates.advisor_prompt = body.advisor_prompt;
    if (body.insights_prompt !== undefined) updates.insights_prompt = body.insights_prompt;
    if (body.tips_prompt !== undefined) updates.tips_prompt = body.tips_prompt;
    if (body.tips_enabled !== undefined) updates.tips_enabled = body.tips_enabled;
    if (body.chat_max_tokens !== undefined) updates.chat_max_tokens = body.chat_max_tokens;
    if (body.session_ttl_minutes !== undefined) updates.session_ttl_minutes = body.session_ttl_minutes;

    if (body.stripe_price_id_pro !== undefined) updates.stripe_price_id_pro = body.stripe_price_id_pro;
    if (body.stripe_price_id_business !== undefined) updates.stripe_price_id_business = body.stripe_price_id_business;

    await updateGlobalSettings(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

