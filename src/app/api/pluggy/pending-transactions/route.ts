import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface LinkInfo {
  id: string;
  name: string;
  institution_name: string;
  pluggy_account_db_id: string;  // UUID from pluggy_accounts.id (used to filter pluggy_transactions.account_id)
  pluggy_account_id: string;     // TEXT from Pluggy API
  internal_account_id: string;
}

/**
 * Get pending (unimported) transactions from Pluggy
 *
 * Supports two modes:
 * 1. Single link mode: ?link_id=xxx - fetch transactions from a specific linked account
 * 2. All links mode: no link_id - fetch transactions from all linked accounts (for Open Finance import)
 *
 * Parameters:
 * - link_id (optional): specific link to fetch from
 * - batch_size (optional): limit results (25, 50, 100) - defaults to 50
 * - limit (optional): alternative to batch_size for backwards compatibility
 * - offset (optional): pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('link_id');
    const batchSize = searchParams.get('batch_size');
    const legacyLimit = searchParams.get('limit');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Use batch_size if provided, otherwise fall back to limit, default to 50
    const limit = batchSize
      ? parseInt(batchSize)
      : (legacyLimit ? parseInt(legacyLimit) : 50);

    // Validate limit to prevent abuse
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    if (linkId) {
      // Single link mode (original behavior)
      return await fetchFromSingleLink(supabase, user.id, linkId, safeLimit, offset);
    } else {
      // All links mode (new behavior for Open Finance import)
      return await fetchFromAllLinks(supabase, user.id, safeLimit, offset);
    }
  } catch (error: any) {
    console.error('Error in GET /api/pluggy/pending-transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Fetch pending transactions from a single linked account
 */
async function fetchFromSingleLink(
  supabase: any,
  userId: string,
  linkId: string,
  limit: number,
  offset: number
) {
  // Get the link to find the Pluggy account ID
  // Include internal account type to filter out credit cards
  const { data: link, error: linkError } = await supabase
    .from('account_links')
    .select(`
      id,
      internal_account_id,
      pluggy_accounts!inner (
        id,
        pluggy_account_id,
        name,
        type,
        subtype,
        pluggy_items!inner (
          connector_name
        )
      ),
      accounts!inner (
        id,
        type
      )
    `)
    .eq('id', linkId)
    .eq('user_id', userId)
    .single();

  if (linkError || !link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }

  // Check if internal account is a credit card - reject if so
  const internalAccount = link.accounts as any;
  if (internalAccount.type === 'credit_card' || internalAccount.type === 'credit') {
    return NextResponse.json({
      error: 'Contas de cartão de crédito não suportam importação de transações via Open Finance. Use o gerenciamento de faturas.',
    }, { status: 400 });
  }

  // Also check if Pluggy account is a credit card
  if (pluggyAccount.type === 'CREDIT' || pluggyAccount.subtype === 'credit_card') {
    return NextResponse.json({
      error: 'Contas de cartão de crédito do Open Finance não podem ter transações importadas. Use o gerenciamento de faturas.',
    }, { status: 400 });
  }

  const pluggyAccountDbId = pluggyAccount.id;  // UUID used for filtering pluggy_transactions.account_id
  const accountName = pluggyAccount.name;
  const institutionName = pluggyAccount.pluggy_items?.connector_name || 'Open Finance';

  // Get unimported transactions
  const { data: transactions, error: txError, count } = await supabase
    .from('pluggy_transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('account_id', pluggyAccountDbId)  // Use UUID from pluggy_accounts.id
    .is('imported_at', null)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (txError) {
    console.error('Error fetching transactions:', txError);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }

  // Add link metadata to each transaction
  const transactionsWithMeta = (transactions || []).map((tx: any) => ({
    ...tx,
    link_id: linkId,
    account_name: accountName,
    institution_name: institutionName,
  }));

  return NextResponse.json({
    transactions: transactionsWithMeta,
    total: count || 0,
    internal_account_id: link.internal_account_id,
    links: [{
      id: linkId,
      name: accountName,
      institution_name: institutionName,
      pending_count: count || 0,
    }],
  });
}

/**
 * Fetch pending transactions from all linked accounts
 */
async function fetchFromAllLinks(
  supabase: any,
  userId: string,
  limit: number,
  offset: number
) {
  // Get all account links with their Pluggy account info
  // Include internal account type to filter out credit cards
  const { data: links, error: linksError } = await supabase
    .from('account_links')
    .select(`
      id,
      internal_account_id,
      pluggy_accounts!inner (
        id,
        pluggy_account_id,
        name,
        type,
        subtype,
        pluggy_items!inner (
          connector_name
        )
      ),
      accounts!inner (
        id,
        type
      )
    `)
    .eq('user_id', userId);

  if (linksError) {
    console.error('Error fetching links:', linksError);
    return NextResponse.json({ error: 'Failed to fetch account links' }, { status: 500 });
  }

  if (!links || links.length === 0) {
    return NextResponse.json({
      transactions: [],
      total: 0,
      links: [],
    });
  }

  // Filter out credit card accounts (both internal and Pluggy)
  // Credit cards are managed via bills/invoices, not individual transactions
  const validLinks = links.filter((link: any) => {
    const internalAccount = link.accounts as any;
    const pluggyAccount = link.pluggy_accounts as any;
    
    // Exclude internal credit card accounts
    if (internalAccount.type === 'credit_card' || internalAccount.type === 'credit') {
      return false;
    }
    
    // Exclude Pluggy credit card accounts
    if (pluggyAccount.type === 'CREDIT' || pluggyAccount.subtype === 'credit_card') {
      return false;
    }
    
    return true;
  });

  if (validLinks.length === 0) {
    return NextResponse.json({
      transactions: [],
      total: 0,
      links: [],
    });
  }

  // Build a map of pluggy_accounts.id (UUID) to link info
  // This is the key used in pluggy_transactions.account_id
  const linkMap = new Map<string, LinkInfo>();
  for (const link of validLinks) {
    const pluggyAccount = link.pluggy_accounts as any;
    linkMap.set(pluggyAccount.id, {  // Use pluggy_accounts.id (UUID) as key
      id: link.id,
      name: pluggyAccount.name,
      institution_name: pluggyAccount.pluggy_items?.connector_name || 'Open Finance',
      pluggy_account_db_id: pluggyAccount.id,
      pluggy_account_id: pluggyAccount.pluggy_account_id,
      internal_account_id: link.internal_account_id,
    });
  }

  const pluggyAccountDbIds = Array.from(linkMap.keys());  // UUIDs from pluggy_accounts.id

  // Get unimported transactions from all linked accounts
  const { data: transactions, error: txError, count } = await supabase
    .from('pluggy_transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .in('account_id', pluggyAccountDbIds)  // Use UUIDs from pluggy_accounts.id
    .is('imported_at', null)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (txError) {
    console.error('Error fetching transactions:', txError);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }

  // Count pending transactions per link
  const pendingCountByAccount = new Map<string, number>();

  // Get counts for each account (using pluggy_accounts.id UUID)
  for (const [accountDbId] of linkMap) {
    const { count: accountCount } = await supabase
      .from('pluggy_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('account_id', accountDbId)  // Use UUID from pluggy_accounts.id
      .is('imported_at', null);

    pendingCountByAccount.set(accountDbId, accountCount || 0);
  }

  // Add link metadata to each transaction
  // tx.account_id is a UUID that matches pluggy_accounts.id
  const transactionsWithMeta = (transactions || []).map((tx: any) => {
    const linkInfo = linkMap.get(tx.account_id);  // Lookup by UUID
    return {
      ...tx,
      link_id: linkInfo?.id || null,
      account_name: linkInfo?.name || 'Conta desconhecida',
      institution_name: linkInfo?.institution_name || 'Open Finance',
    };
  });

  // Build links summary with pending counts
  const linksSummary = Array.from(linkMap.values()).map(link => ({
    id: link.id,
    name: link.name,
    institution_name: link.institution_name,
    pending_count: pendingCountByAccount.get(link.pluggy_account_db_id) || 0,  // Use UUID
  }));

  return NextResponse.json({
    transactions: transactionsWithMeta,
    total: count || 0,
    links: linksSummary,
  });
}
