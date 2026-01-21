import { NextResponse } from 'next/server';
import { getLatestCdiRate, dailyToMonthlyRate, dailyToAnnualRate } from '@/services/bacen/cdi';

// Force dynamic rendering since this route may use cookies indirectly
export const dynamic = 'force-dynamic';

/**
 * GET /api/cdi
 * Returns the latest CDI rate from BACEN
 *
 * Response:
 * {
 *   date: string (YYYY-MM-DD),
 *   daily_rate: number (e.g., 0.055131 for 0.055131% per day),
 *   monthly_rate: number (approximate monthly rate),
 *   annual_rate: number (approximate annual rate),
 *   fetched_at: string (ISO date)
 * }
 */
export async function GET() {
  try {
    const rate = await getLatestCdiRate();

    if (!rate) {
      return NextResponse.json(
        { error: 'Não foi possível obter a taxa CDI. Tente novamente mais tarde.' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      date: rate.date.toISOString().split('T')[0],
      daily_rate: rate.dailyRate,
      monthly_rate: dailyToMonthlyRate(rate.dailyRate),
      annual_rate: dailyToAnnualRate(rate.dailyRate),
      fetched_at: rate.fetchedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching CDI rate:', error);
    return NextResponse.json(
      { error: 'Erro interno ao buscar taxa CDI' },
      { status: 500 }
    );
  }
}
