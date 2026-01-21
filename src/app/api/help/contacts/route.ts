import { NextResponse } from 'next/server';
import { getGlobalSettings, clearSettingsCache } from '@/services/admin/globalSettings';

// Force dynamic rendering since this route uses admin client that requires SUPABASE_SERVICE_ROLE_KEY
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Clear cache and force refresh to ensure fresh data
    clearSettingsCache();
    
    const settings = await getGlobalSettings(true); // Force refresh

    // Retornar apenas os campos de contato (sem dados sensíveis)
    const contacts = {
      email: settings.support_email || null,
      whatsapp: settings.support_whatsapp || null,
    };

    console.log('[Help Contacts API] Returning contacts:', {
      hasEmail: !!contacts.email,
      hasWhatsapp: !!contacts.whatsapp,
      email: contacts.email,
      whatsapp: contacts.whatsapp,
    });

    return NextResponse.json(contacts, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[Help Contacts API] Error fetching support contacts:', error);
    return NextResponse.json(
      { email: null, whatsapp: null },
      { 
        status: 200, // Retornar 200 mesmo em erro para não quebrar a UI
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }
}
