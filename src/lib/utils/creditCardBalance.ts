/**
 * Credit Card Balance Utilities
 * 
 * Manages current_balance and available_balance calculations for credit cards.
 * current_balance = sum of all unpaid bills (total_cents - paid_cents)
 * available_balance = credit_limit - current_balance
 */

export async function recalculateCreditCardBalance(
  supabase: any,
  cardId: string
): Promise<void> {
  // Get all unpaid bills (any status except 'paid')
  const { data: bills, error: billsError } = await supabase
    .from('credit_card_bills')
    .select('total_cents, paid_cents')
    .eq('account_id', cardId)
    .not('status', 'eq', 'paid');

  if (billsError) {
    console.error('Error fetching bills for balance recalculation:', billsError);
    return;
  }

  // Calculate total unpaid amount
  const totalUnpaidCents = (bills || []).reduce((sum: number, bill: any) => {
    const unpaid = (bill.total_cents || 0) - (bill.paid_cents || 0);
    return sum + unpaid;
  }, 0);

  // Get credit limit
  const { data: card, error: cardError } = await supabase
    .from('accounts')
    .select('credit_limit')
    .eq('id', cardId)
    .single();

  if (cardError) {
    console.error('Error fetching card for balance recalculation:', cardError);
    return;
  }

  const creditLimitCents = Math.round((card?.credit_limit || 0) * 100);
  const newAvailableBalanceCents = Math.max(0, creditLimitCents - totalUnpaidCents);

  // Update card balances
  const { error: updateError } = await supabase
    .from('accounts')
    .update({
      current_balance: totalUnpaidCents / 100, // Convert cents to reais
      available_balance: newAvailableBalanceCents / 100, // Convert cents to reais
    })
    .eq('id', cardId);

  if (updateError) {
    console.error('Error updating credit card balance:', updateError);
  }
}

/**
 * Recalculate balances for all credit cards of a user
 */
export async function recalculateAllCreditCardBalances(
  supabase: any,
  userId: string
): Promise<void> {
  const { data: cards, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'credit_card');

  if (error) {
    console.error('Error fetching credit cards:', error);
    return;
  }

  for (const card of cards || []) {
    await recalculateCreditCardBalance(supabase, card.id);
  }
}
