'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MapData {
  state: string;
  total_expenses: number;
  total_income: number;
  transaction_count: number;
  user_count: number;
}

export default function BrazilMap() {
  const [data, setData] = useState<MapData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMapData();
  }, []);

  const fetchMapData = async () => {
    try {
      const res = await fetch('/api/admin/map-data');
      if (!res.ok) throw new Error('Failed to fetch map data');
      const result = await res.json();
      setData(result.data || []);
    } catch (error) {
      console.error('Error fetching map data:', error);
    } finally {
      setLoading(false);
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
      <CardHeader>
        <CardTitle>Mapa do Brasil - Gastos por Estado</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Carregando mapa...</div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Visualização dos gastos agregados por estado. (Mapa interativo será implementado com react-simple-maps)
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.map((item) => (
                <div key={item.state} className="border rounded-lg p-4">
                  <div className="font-semibold text-lg">{item.state}</div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>Despesas: {formatCurrency(item.total_expenses)}</div>
                    <div>Receitas: {formatCurrency(item.total_income)}</div>
                    <div>Transações: {item.transaction_count}</div>
                    <div>Usuários: {item.user_count}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

