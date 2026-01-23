import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isPluggyEnabled } from '@/services/pluggy/client';
import { isAdmin } from '@/lib/auth';

/**
 * Check if Open Finance import is available for the current user
 * Currently restricted to admins only when Pluggy is enabled
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if Pluggy is enabled in global settings
    const pluggyEnabled = await isPluggyEnabled();
    if (!pluggyEnabled) {
      return NextResponse.json({
        available: false,
        reason: 'Open Finance não está habilitado',
        hasLinkedAccounts: false,
        linkedAccountsCount: 0,
      });
    }

    // Check if user is admin (current restriction)
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({
        available: false,
        reason: 'Open Finance está disponível apenas para administradores',
        hasLinkedAccounts: false,
        linkedAccountsCount: 0,
      });
    }

    // Count linked accounts for the user
    const { count, error } = await supabase
      .from('account_links')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error counting linked accounts:', error);
      return NextResponse.json({
        available: true,
        hasLinkedAccounts: false,
        linkedAccountsCount: 0,
      });
    }

    const linkedAccountsCount = count || 0;

    return NextResponse.json({
      available: true,
      hasLinkedAccounts: linkedAccountsCount > 0,
      linkedAccountsCount,
    });
  } catch (error: any) {
    console.error('Error in GET /api/pluggy/availability:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
