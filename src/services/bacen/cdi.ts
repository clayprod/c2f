/**
 * Service to fetch CDI (DI) rates from BACEN (Brazilian Central Bank)
 *
 * The CDI rate is published daily (business days only) and represents
 * the interbank deposit rate used as a benchmark for investments.
 *
 * API Endpoint: https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json
 * Returns: [{"data":"19/01/2026","valor":"0.055131"}]
 *
 * Note: Rates are updated Tuesday to Saturday (reflecting the previous business day)
 */

import { createClient } from '@/lib/supabase/server';

const BACEN_CDI_API = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados';

interface BacenCdiResponse {
  data: string; // Date in DD/MM/YYYY format
  valor: string; // Daily rate as string (e.g., "0.055131")
}

interface CdiRate {
  date: Date;
  dailyRate: number;
  fetchedAt: Date;
}

/**
 * Parse BACEN date format (DD/MM/YYYY) to Date object
 */
function parseBacenDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format Date to BACEN API date format (DD/MM/YYYY)
 */
function formatBacenDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format Date to PostgreSQL date format (YYYY-MM-DD)
 */
function formatPostgresDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Fetch the latest CDI rate from BACEN API
 */
export async function fetchLatestCdiRateFromBacen(): Promise<CdiRate | null> {
  try {
    const response = await fetch(`${BACEN_CDI_API}/ultimos/1?formato=json`, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`BACEN API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: BacenCdiResponse[] = await response.json();

    if (!data || data.length === 0) {
      console.error('BACEN API returned empty data');
      return null;
    }

    const rate = data[0];
    return {
      date: parseBacenDate(rate.data),
      dailyRate: parseFloat(rate.valor),
      fetchedAt: new Date(),
    };
  } catch (error) {
    console.error('Error fetching CDI rate from BACEN:', error);
    return null;
  }
}

/**
 * Fetch CDI rates for a date range from BACEN API
 */
export async function fetchCdiRatesForPeriod(startDate: Date, endDate: Date): Promise<CdiRate[]> {
  try {
    const startStr = formatBacenDate(startDate);
    const endStr = formatBacenDate(endDate);

    const response = await fetch(
      `${BACEN_CDI_API}?formato=json&dataInicial=${startStr}&dataFinal=${endStr}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`BACEN API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: BacenCdiResponse[] = await response.json();

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(rate => ({
      date: parseBacenDate(rate.data),
      dailyRate: parseFloat(rate.valor),
      fetchedAt: new Date(),
    }));
  } catch (error) {
    console.error('Error fetching CDI rates from BACEN:', error);
    return [];
  }
}

/**
 * Get CDI rate for a specific date from cache or fetch from BACEN
 */
export async function getCdiRate(date: Date): Promise<number | null> {
  const supabase = await createClient();
  const dateStr = formatPostgresDate(date);

  // Try to get from cache first
  const { data: cached } = await supabase
    .from('cdi_rates')
    .select('daily_rate')
    .eq('rate_date', dateStr)
    .single();

  if (cached) {
    return cached.daily_rate;
  }

  // If not in cache, fetch from BACEN
  const rates = await fetchCdiRatesForPeriod(date, date);
  if (rates.length > 0) {
    // Cache the rate
    await supabase
      .from('cdi_rates')
      .upsert({
        rate_date: dateStr,
        daily_rate: rates[0].dailyRate,
        fetched_at: new Date().toISOString(),
        source: 'bacen',
      });
    return rates[0].dailyRate;
  }

  return null;
}

/**
 * Get CDI rates for a period, fetching missing ones from BACEN
 */
export async function getCdiRatesForPeriod(
  startDate: Date,
  endDate: Date
): Promise<Map<string, number>> {
  const supabase = await createClient();
  const startStr = formatPostgresDate(startDate);
  const endStr = formatPostgresDate(endDate);

  // Get cached rates
  const { data: cachedRates } = await supabase
    .from('cdi_rates')
    .select('rate_date, daily_rate')
    .gte('rate_date', startStr)
    .lte('rate_date', endStr);

  const ratesMap = new Map<string, number>();

  if (cachedRates) {
    for (const rate of cachedRates) {
      ratesMap.set(rate.rate_date, rate.daily_rate);
    }
  }

  // Check if we need to fetch more rates
  // We'll fetch if we have less than expected business days (roughly 22 per month)
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const expectedBusinessDays = Math.ceil(daysDiff * 5 / 7); // Rough estimate

  if (ratesMap.size < expectedBusinessDays * 0.8) {
    // Fetch missing rates from BACEN
    const fetchedRates = await fetchCdiRatesForPeriod(startDate, endDate);

    // Cache and add to map
    const toUpsert = fetchedRates
      .filter(rate => !ratesMap.has(formatPostgresDate(rate.date)))
      .map(rate => ({
        rate_date: formatPostgresDate(rate.date),
        daily_rate: rate.dailyRate,
        fetched_at: new Date().toISOString(),
        source: 'bacen',
      }));

    if (toUpsert.length > 0) {
      await supabase
        .from('cdi_rates')
        .upsert(toUpsert);
    }

    for (const rate of fetchedRates) {
      ratesMap.set(formatPostgresDate(rate.date), rate.dailyRate);
    }
  }

  return ratesMap;
}

/**
 * Get the latest available CDI rate (from cache or BACEN)
 */
export async function getLatestCdiRate(): Promise<CdiRate | null> {
  const supabase = await createClient();

  // Try to get the most recent cached rate
  const { data: cached } = await supabase
    .from('cdi_rates')
    .select('rate_date, daily_rate, fetched_at')
    .order('rate_date', { ascending: false })
    .limit(1)
    .single();

  // If we have a recent cache (within last 24 hours), use it
  if (cached) {
    const cachedDate = new Date(cached.rate_date);
    const now = new Date();
    const hoursSinceCache = (now.getTime() - new Date(cached.fetched_at).getTime()) / (1000 * 60 * 60);

    // If cache is less than 6 hours old, use it
    if (hoursSinceCache < 6) {
      return {
        date: cachedDate,
        dailyRate: cached.daily_rate,
        fetchedAt: new Date(cached.fetched_at),
      };
    }
  }

  // Fetch fresh rate from BACEN
  const freshRate = await fetchLatestCdiRateFromBacen();

  if (freshRate) {
    // Cache it
    await supabase
      .from('cdi_rates')
      .upsert({
        rate_date: formatPostgresDate(freshRate.date),
        daily_rate: freshRate.dailyRate,
        fetched_at: freshRate.fetchedAt.toISOString(),
        source: 'bacen',
      });
    return freshRate;
  }

  // If BACEN is unavailable, return the cached rate if we have one
  if (cached) {
    return {
      date: new Date(cached.rate_date),
      dailyRate: cached.daily_rate,
      fetchedAt: new Date(cached.fetched_at),
    };
  }

  return null;
}

/**
 * Convert CDI percentage to effective daily rate
 *
 * If an account has 100% CDI, and the daily CDI rate is 0.055131%,
 * the account's effective daily rate is also 0.055131%.
 *
 * If an account has 120% CDI, the effective daily rate is 0.055131 * 1.20 = 0.0661572%
 *
 * @param cdiPercentage - The percentage of CDI (e.g., 100 for 100%, 120 for 120%)
 * @param dailyCdiRate - The daily CDI rate (e.g., 0.055131)
 * @returns The effective daily rate
 */
export function calculateEffectiveDailyRate(cdiPercentage: number, dailyCdiRate: number): number {
  return dailyCdiRate * (cdiPercentage / 100);
}

/**
 * Convert daily CDI rate to monthly rate (approximate)
 * Uses compound interest formula: monthlyRate = (1 + dailyRate/100)^22 - 1
 * Assumes 22 business days per month
 *
 * @param dailyRate - Daily rate in percentage (e.g., 0.055131 for 0.055131%)
 * @returns Monthly rate in percentage
 */
export function dailyToMonthlyRate(dailyRate: number): number {
  const businessDaysPerMonth = 22; // Approximate
  return ((1 + dailyRate / 100) ** businessDaysPerMonth - 1) * 100;
}

/**
 * Convert daily CDI rate to annual rate (approximate)
 * Uses compound interest formula: annualRate = (1 + dailyRate/100)^252 - 1
 * Assumes 252 business days per year
 *
 * @param dailyRate - Daily rate in percentage (e.g., 0.055131 for 0.055131%)
 * @returns Annual rate in percentage
 */
export function dailyToAnnualRate(dailyRate: number): number {
  const businessDaysPerYear = 252; // Standard for Brazil
  return ((1 + dailyRate / 100) ** businessDaysPerYear - 1) * 100;
}
