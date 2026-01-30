import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { projectionCache } from '@/services/projections/cache';
import { parseInstallment, formatInstallmentDescription, removeInstallmentPattern } from '@/lib/utils/installmentParser';

interface TransactionToImport {
  id: string;
  category_id?: string | null;
}

interface ImportResults {
  imported: number;
  skipped: number;
  bill_items_created: number;
  transfers_detected?: number;
  errors: string[];
}

/**
 * Import selected Pluggy transactions to main transactions table or credit card bills
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { link_id, transactions: transactionsToImport } = body as {
      link_id: string;
      transactions: TransactionToImport[];
    };

    if (!link_id || !transactionsToImport || transactionsToImport.length === 0) {
      return NextResponse.json(
        { error: 'link_id and transactions are required' },
        { status: 400 }
      );
    }

    // Get the link with full account details
    const { data: link, error: linkError } = await supabase
      .from('account_links')
      .select(`
        internal_account_id,
        pluggy_accounts!inner (
          type,
          subtype
        ),
        accounts!inner (
          id,
          type,
          closing_day,
          due_day
        )
      `)
      .eq('id', link_id)
      .eq('user_id', user.id)
      .single();

    if (linkError || !link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const internalAccount = link.accounts as any;
    const pluggyAccount = link.pluggy_accounts as any;
    const internalAccountId = link.internal_account_id;

    // Detect if this is a credit card account
    const isCreditCard = 
      internalAccount.type === 'credit_card' || 
      internalAccount.type === 'credit' ||
      pluggyAccount.type === 'CREDIT' || 
      pluggyAccount.subtype === 'credit_card';

    // Get the pluggy transactions
    const transactionIds = transactionsToImport.map(t => t.id);
    const { data: pluggyTransactions, error: txError } = await supabase
      .from('pluggy_transactions')
      .select('*')
      .eq('user_id', user.id)
      .in('id', transactionIds)
      .is('imported_at', null);

    if (txError) {
      console.error('Error fetching pluggy transactions:', txError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!pluggyTransactions || pluggyTransactions.length === 0) {
      return NextResponse.json({ error: 'No valid transactions to import' }, { status: 400 });
    }

    // Get or create fallback category
    const fallbackCategoryId = await getOrCreateFallbackCategory(supabase, user.id);

    // Create a map of transaction IDs to category IDs from the request
    const categoryMap = new Map(
      transactionsToImport.map(t => [t.id, t.category_id])
    );

    // Import based on account type
    let results: ImportResults;
    if (isCreditCard) {
      results = await importCreditCardTransactions(
        supabase,
        user.id,
        internalAccountId,
        internalAccount,
        pluggyTransactions,
        categoryMap,
        fallbackCategoryId
      );
    } else {
      results = await importRegularTransactions(
        supabase,
        user.id,
        internalAccountId,
        pluggyTransactions,
        categoryMap,
        fallbackCategoryId
      );
    }

    projectionCache.invalidateUser(user.id);

    // Auto-detect transfers after import (for regular transactions only, not credit cards)
    if (!isCreditCard && results.imported > 0) {
      try {
        const dates = pluggyTransactions.map(tx => new Date(tx.date));
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        
        const { data: detectResult, error: detectError } = await supabase
          .rpc('auto_detect_transfers', {
            p_user_id: user.id,
            p_start_date: minDate.toISOString().split('T')[0],
            p_end_date: maxDate.toISOString().split('T')[0],
          });
        
        if (!detectError && detectResult) {
          results.transfers_detected = detectResult.detected_count || 0;
        }
      } catch (detectErr) {
        console.error('Error auto-detecting transfers:', detectErr);
        // Don't fail the import if detection fails
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('Error in POST /api/pluggy/import:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Get or create "OUTROS" category as fallback
 */
async function getOrCreateFallbackCategory(supabase: any, userId: string): Promise<string | null> {
  const { data: outrosCategory } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', 'outros')
    .maybeSingle();

  if (outrosCategory) {
    return outrosCategory.id;
  }

  const { data: newCategory } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name: 'OUTROS',
      type: 'expense',
      icon: '📦',
      color: '#808080',
    })
    .select()
    .single();

  return newCategory?.id || null;
}

/**
 * Import regular (non-credit-card) transactions
 */
async function importRegularTransactions(
  supabase: any,
  userId: string,
  accountId: string,
  pluggyTransactions: any[],
  categoryMap: Map<string, string | null | undefined>,
  fallbackCategoryId: string | null
): Promise<ImportResults> {
  const results: ImportResults = {
    imported: 0,
    skipped: 0,
    bill_items_created: 0,
    errors: [],
  };

  for (const pluggyTx of pluggyTransactions) {
    try {
      const requestedCategoryId = categoryMap.get(pluggyTx.id);
      const categoryId = requestedCategoryId || fallbackCategoryId;

      const amountCents = Number(pluggyTx.amount_cents) || 0;
      const signedAmountCents = pluggyTx.type === 'debit' ? -Math.abs(amountCents) : Math.abs(amountCents);
      const signedAmountReais = signedAmountCents / 100;

      const { data: newTx, error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          account_id: accountId,
          category_id: categoryId,
          posted_at: pluggyTx.date,
          description: pluggyTx.description,
          amount: signedAmountReais,
          currency: pluggyTx.currency || 'BRL',
          source: 'pluggy',
          provider_tx_id: pluggyTx.pluggy_transaction_id,
          notes: `Importado via Open Finance - ${pluggyTx.type === 'debit' ? 'despesa' : 'receita'}`,
        })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          results.skipped++;
        } else {
          console.error('Error inserting transaction:', insertError);
          results.errors.push(`Erro ao importar: ${pluggyTx.description} - ${insertError.message}`);
        }
        continue;
      }

      // Mark as imported
      await supabase
        .from('pluggy_transactions')
        .update({
          imported_at: new Date().toISOString(),
          imported_transaction_id: newTx?.id,
        })
        .eq('id', pluggyTx.id);

      results.imported++;
    } catch (error: any) {
      console.error('Error importing transaction:', error);
      results.errors.push(`Erro ao importar: ${pluggyTx.description}`);
    }
  }

  return results;
}

/**
 * Import credit card transactions as bill items with installment expansion
 */
async function importCreditCardTransactions(
  supabase: any,
  userId: string,
  accountId: string,
  cardAccount: any,
  pluggyTransactions: any[],
  categoryMap: Map<string, string | null | undefined>,
  fallbackCategoryId: string | null
): Promise<ImportResults> {
  const results: ImportResults = {
    imported: 0,
    skipped: 0,
    bill_items_created: 0,
    errors: [],
  };

  // Get card's closing day (default to 10 if not set)
  const closingDay = cardAccount.closing_day || 10;
  const dueDay = cardAccount.due_day || closingDay + 10;

  for (const pluggyTx of pluggyTransactions) {
    try {
      const requestedCategoryId = categoryMap.get(pluggyTx.id);
      const categoryId = requestedCategoryId || fallbackCategoryId;

      // Parse installment info from description
      const installmentInfo = parseInstallment(pluggyTx.description);
      const amountCents = Number(pluggyTx.amount_cents) || 0;

      if (installmentInfo && installmentInfo.totalInstallments > 1) {
        // Handle installment purchase - expand across multiple months
        const itemsCreated = await createInstallmentBillItems(
          supabase,
          userId,
          accountId,
          pluggyTx,
          categoryId,
          installmentInfo,
          closingDay,
          dueDay,
          amountCents
        );

        if (itemsCreated > 0) {
          results.bill_items_created += itemsCreated;
          results.imported++;

          // Mark as imported
          await supabase
            .from('pluggy_transactions')
            .update({
              imported_at: new Date().toISOString(),
            })
            .eq('id', pluggyTx.id);
        } else {
          results.skipped++;
        }
      } else {
        // Single purchase - create one bill item
        const success = await createSingleBillItem(
          supabase,
          userId,
          accountId,
          pluggyTx,
          categoryId,
          closingDay,
          dueDay,
          amountCents
        );

        if (success) {
          results.bill_items_created++;
          results.imported++;

          // Mark as imported
          await supabase
            .from('pluggy_transactions')
            .update({
              imported_at: new Date().toISOString(),
            })
            .eq('id', pluggyTx.id);
        } else {
          results.skipped++;
        }
      }
    } catch (error: any) {
      console.error('Error importing credit card transaction:', error);
      results.errors.push(`Erro ao importar: ${pluggyTx.description} - ${error.message}`);
    }
  }

  return results;
}

/**
 * Create installment bill items across multiple months
 */
async function createInstallmentBillItems(
  supabase: any,
  userId: string,
  accountId: string,
  pluggyTx: any,
  categoryId: string | null,
  installmentInfo: { currentInstallment: number; totalInstallments: number },
  closingDay: number,
  dueDay: number,
  totalAmountCents: number
): Promise<number> {
  const { currentInstallment, totalInstallments } = installmentInfo;
  
  // Calculate amount per installment (divide total by total installments)
  // The amount from Pluggy is already the total, so we divide it
  const amountPerInstallmentCents = Math.round(totalAmountCents / totalInstallments);
  
  // Calculate base date from transaction date
  const txDate = new Date(pluggyTx.date);
  const baseMonth = calculateBillMonth(txDate, closingDay);
  
  // Clean description for use in items
  const cleanDescription = removeInstallmentPattern(pluggyTx.description);
  
  let itemsCreated = 0;
  let parentId: string | null = null;

  // Create bill items for current and remaining installments
  for (let i = currentInstallment; i <= totalInstallments; i++) {
    // Calculate the target month for this installment
    const monthOffset = i - currentInstallment;
    const targetMonth = new Date(baseMonth);
    targetMonth.setMonth(targetMonth.getMonth() + monthOffset);

    // Get or create the bill for this month
    const bill = await getOrCreateBill(supabase, userId, accountId, targetMonth, closingDay, dueDay);
    
    if (!bill) {
      console.error(`Failed to get/create bill for month ${targetMonth.toISOString()}`);
      continue;
    }

    // Generate unique provider_tx_id for deduplication
    const providerTxId = `${pluggyTx.pluggy_transaction_id}_inst_${i}`;

    // Check if this installment already exists
    const { data: existing } = await supabase
      .from('credit_card_bill_items')
      .select('id')
      .eq('user_id', userId)
      .eq('provider_tx_id', providerTxId)
      .maybeSingle();

    if (existing) {
      // Already imported, skip
      continue;
    }

    // Create the bill item
    const itemData: any = {
      user_id: userId,
      account_id: accountId,
      bill_id: bill.id,
      category_id: categoryId,
      posted_at: bill.reference_month,
      description: formatInstallmentDescription(cleanDescription, i, totalInstallments),
      amount_cents: amountPerInstallmentCents,
      currency: pluggyTx.currency || 'BRL',
      source: 'pluggy',
      provider_tx_id: providerTxId,
      installment_number: i,
      installment_total: totalInstallments,
      notes: `Importado via Open Finance - Parcela ${i}/${totalInstallments}`,
    };

    // Link to parent if not the first
    if (parentId) {
      itemData.installment_parent_id = parentId;
    }

    const { data: newItem, error: insertError } = await supabase
      .from('credit_card_bill_items')
      .insert(itemData)
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting bill item:', insertError);
      continue;
    }

    // First item becomes the parent
    if (!parentId && newItem) {
      parentId = newItem.id;
    }

    itemsCreated++;

    // Recalculate bill total
    await recalculateBillTotal(supabase, bill.id);
  }

  return itemsCreated;
}

/**
 * Create a single bill item (non-installment)
 */
async function createSingleBillItem(
  supabase: any,
  userId: string,
  accountId: string,
  pluggyTx: any,
  categoryId: string | null,
  closingDay: number,
  dueDay: number,
  amountCents: number
): Promise<boolean> {
  const txDate = new Date(pluggyTx.date);
  const targetMonth = calculateBillMonth(txDate, closingDay);

  // Get or create the bill for this month
  const bill = await getOrCreateBill(supabase, userId, accountId, targetMonth, closingDay, dueDay);
  
  if (!bill) {
    console.error(`Failed to get/create bill for month ${targetMonth.toISOString()}`);
    return false;
  }

  // Check if already imported
  const { data: existing } = await supabase
    .from('credit_card_bill_items')
    .select('id')
    .eq('user_id', userId)
    .eq('provider_tx_id', pluggyTx.pluggy_transaction_id)
    .maybeSingle();

  if (existing) {
    return false; // Already imported
  }

  const { error: insertError } = await supabase
    .from('credit_card_bill_items')
    .insert({
      user_id: userId,
      account_id: accountId,
      bill_id: bill.id,
      category_id: categoryId,
      posted_at: pluggyTx.date,
      description: pluggyTx.description,
      amount_cents: amountCents,
      currency: pluggyTx.currency || 'BRL',
      source: 'pluggy',
      provider_tx_id: pluggyTx.pluggy_transaction_id,
      notes: 'Importado via Open Finance',
    });

  if (insertError) {
    console.error('Error inserting bill item:', insertError);
    return false;
  }

  // Recalculate bill total
  await recalculateBillTotal(supabase, bill.id);

  return true;
}

/**
 * Calculate which bill month a transaction belongs to based on closing day
 */
function calculateBillMonth(txDate: Date, closingDay: number): Date {
  const day = txDate.getDate();
  const month = txDate.getMonth();
  const year = txDate.getFullYear();

  // If transaction is after closing day, it goes to next month's bill
  if (day > closingDay) {
    const nextMonth = new Date(year, month + 1, 1);
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
  }

  // Otherwise, it goes to current month's bill
  return new Date(year, month, 1);
}

/**
 * Get or create a credit card bill for a specific month
 */
async function getOrCreateBill(
  supabase: any,
  userId: string,
  accountId: string,
  referenceMonth: Date,
  closingDay: number,
  dueDay: number
): Promise<{ id: string; reference_month: string } | null> {
  const refMonthStr = referenceMonth.toISOString().split('T')[0]; // YYYY-MM-DD (first of month)

  // Try to get existing bill
  const { data: existingBill } = await supabase
    .from('credit_card_bills')
    .select('id, reference_month')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .eq('reference_month', refMonthStr)
    .maybeSingle();

  if (existingBill) {
    return existingBill;
  }

  // Calculate closing and due dates for this bill
  const year = referenceMonth.getFullYear();
  const month = referenceMonth.getMonth();
  
  const closingDate = new Date(year, month, Math.min(closingDay, getDaysInMonth(year, month)));
  const dueDateMonth = dueDay > closingDay ? month : month + 1;
  const dueDateYear = dueDateMonth > 11 ? year + 1 : year;
  const adjustedDueDateMonth = dueDateMonth > 11 ? 0 : dueDateMonth;
  const dueDate = new Date(dueDateYear, adjustedDueDateMonth, Math.min(dueDay, getDaysInMonth(dueDateYear, adjustedDueDateMonth)));

  // Create new bill
  const { data: newBill, error } = await supabase
    .from('credit_card_bills')
    .insert({
      user_id: userId,
      account_id: accountId,
      reference_month: refMonthStr,
      closing_date: closingDate.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      status: 'open',
      total_cents: 0,
      paid_cents: 0,
    })
    .select('id, reference_month')
    .single();

  if (error) {
    console.error('Error creating bill:', error);
    return null;
  }

  return newBill;
}

/**
 * Recalculate bill total from its items
 */
async function recalculateBillTotal(supabase: any, billId: string): Promise<void> {
  // Call the database function to recalculate
  const { error } = await supabase.rpc('recalculate_credit_card_bill', { p_bill_id: billId });
  
  if (error) {
    console.error('Error recalculating bill:', error);
  }
}

/**
 * Get the number of days in a month
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
