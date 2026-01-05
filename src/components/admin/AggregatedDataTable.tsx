'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AggregatedData {
  group: string;
  total_expenses: number;
  total_income: number;
  transaction_count: number;
  user_count: number;
}

interface AggregatedDataTableProps {
  filters?: any;
}

export default function AggregatedDataTable({ filters }: AggregatedDataTableProps) {
  const [data, setData] = useState<AggregatedData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (filters) {
      fetchData(filters);
    }
  }, [filters]);

  const fetchData = async (filterParams: any) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });

      const res = await fetch(`/api/admin/transactions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const result = await res.json();
      setData(result.data || []);
    } catch (error) {
      console.error('Error fetching aggregated data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
          }
        });
      }

      const res = await fetch(`/api/admin/export?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to export');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_admin_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value / 100);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Dados Agregados</CardTitle>
        <Button onClick={handleExportCSV} variant="outline">
          Exportar CSV
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum dado encontrado. Aplique os filtros para ver os resultados.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead>Total Despesas</TableHead>
                <TableHead>Total Receitas</TableHead>
                <TableHead>Transações</TableHead>
                <TableHead>Usuários</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{row.group}</TableCell>
                  <TableCell>{formatCurrency(row.total_expenses)}</TableCell>
                  <TableCell>{formatCurrency(row.total_income)}</TableCell>
                  <TableCell>{row.transaction_count}</TableCell>
                  <TableCell>{row.user_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

