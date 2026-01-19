import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getAggregatedTransactions, type AggregationFilters } from '@/services/admin/aggregations';

function arrayToCSV(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (value: string | number | null): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escape).join(',');
  const dataLines = rows.map(row => row.map(escape).join(','));
  
  return [headerLine, ...dataLines].join('\n');
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const filters: AggregationFilters = {
      fromDate: searchParams.get('from_date') || undefined,
      toDate: searchParams.get('to_date') || undefined,
      period: searchParams.get('period') as any,
      search: searchParams.get('search') || undefined,
      minAge: searchParams.get('min_age') ? parseInt(searchParams.get('min_age')!) : undefined,
      maxAge: searchParams.get('max_age') ? parseInt(searchParams.get('max_age')!) : undefined,
      gender: searchParams.get('gender') || undefined,
      categoryId: searchParams.get('category_id') || undefined,
      groupBy: (searchParams.get('group_by') as any) || 'state',
    };

    const data = await getAggregatedTransactions(request, filters);

    const headers = ['Grupo', 'Total Despesas (R$)', 'Total Receitas (R$)', 'Quantidade de Transações', 'Quantidade de Usuários'];
    const rows = data.map(d => [
      d.group,
      (d.total_expenses / 100).toFixed(2),
      (d.total_income / 100).toFixed(2),
      d.transaction_count,
      d.user_count,
    ]);

    const csv = arrayToCSV(headers, rows);
    
    const groupByLabel = filters.groupBy === 'city' ? 'cidade' : 
                         filters.groupBy === 'state' ? 'estado' :
                         filters.groupBy === 'category' ? 'categoria' : 'mes';
    
    const filename = `relatorio_admin_${groupByLabel}_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}


