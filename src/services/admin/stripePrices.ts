/**
 * Stripe Prices Service
 * Functions to manage Stripe prices using MCP Stripe
 */

export interface StripeProduct {
  id: string;
  name: string;
  description?: string;
}

export interface StripePrice {
  id: string;
  product: string;
  unit_amount: number;
  currency: string;
  active: boolean;
}

/**
 * List all products from Stripe via MCP
 */
export async function listStripeProducts(): Promise<StripeProduct[]> {
  // Note: MCP functions are called directly in API routes, not here
  // This is a type definition and helper utilities
  return [];
}

/**
 * List prices for a specific product
 */
export async function listStripePrices(productId?: string): Promise<StripePrice[]> {
  // Note: MCP functions are called directly in API routes
  return [];
}

/**
 * Convert reais to cents (Stripe unit_amount)
 */
export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Convert cents to reais
 */
export function centsToReais(cents: number): number {
  return cents / 100;
}

