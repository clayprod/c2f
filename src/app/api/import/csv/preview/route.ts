import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { parseCSV } from '@/services/import/csvParser';
import { createErrorResponse } from '@/lib/errors';

/**
 * Preview CSV transactions without importing
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { csv_content } = body;

    if (!csv_content) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 });
    }

    // Parse CSV file
    const transactions = parseCSV(csv_content);

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma transação válida encontrada no CSV. Verifique o formato.' },
        { status: 400 }
      );
    }

    // Convert to preview format
    const previewTransactions = transactions.map((tx, index) => ({
      id: tx.id || `csv-${index}`,
      date: tx.date,
      description: tx.description,
      // CSV stores amounts as positive with type indicator
      // For preview, we show signed amounts
      amount: tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
      categoryName: tx.categoryName,
      accountName: tx.accountName,
    }));

    return NextResponse.json({
      transactions: previewTransactions,
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
