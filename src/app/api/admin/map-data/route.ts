import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getAggregatedTransactions, type AggregationFilters } from '@/services/admin/aggregations';
import { getMultipleCityCoordinates } from '@/services/admin/cityCoordinates';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const groupBy = (searchParams.get('group_by') as 'city' | 'state') || 'state';
    
    const filters: AggregationFilters = {
      fromDate: searchParams.get('from_date') || undefined,
      toDate: searchParams.get('to_date') || undefined,
      period: searchParams.get('period') as any,
      search: searchParams.get('search') || undefined,
      minAge: searchParams.get('min_age') ? parseInt(searchParams.get('min_age')!) : undefined,
      maxAge: searchParams.get('max_age') ? parseInt(searchParams.get('max_age')!) : undefined,
      gender: searchParams.get('gender') || undefined,
      categoryId: searchParams.get('category_id') || undefined,
      groupBy,
    };

    let data: any[];
    try {
      data = await getAggregatedTransactions(request, filters);
    } catch (error: any) {
      console.error('Error getting aggregated transactions:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to get aggregated transactions', data: [] },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ data: [] });
    }

    if (groupBy === 'city') {
      // Para cidades, precisamos buscar o estado de cada cidade
      // Vamos fazer uma query adicional para obter cidade+estado
      const { supabase } = createClientFromRequest(request);
      
      // Obter todas as cidades únicas dos dados
      const cities = data
        .filter(d => d.group && d.group !== 'Não informado')
        .map(d => d.group);

      if (cities.length === 0) {
        return NextResponse.json({ data: [] });
      }

      // Buscar estados correspondentes às cidades
      const { data: profiles } = await supabase
        .from('profiles')
        .select('city, state')
        .in('city', cities)
        .not('state', 'is', null)
        .not('city', 'is', null);

      // Criar mapa cidade -> estado
      const cityToState = new Map<string, string>();
      if (profiles) {
        profiles.forEach((p: any) => {
          if (p.city && p.state && !cityToState.has(p.city)) {
            cityToState.set(p.city, p.state);
          }
        });
      }

      // Preparar dados com cidade e estado
      const cityDataWithState = data
        .filter(d => d.group && d.group !== 'Não informado')
        .map(d => ({
          city: d.group,
          state: cityToState.get(d.group) || 'SP', // Fallback para SP se não encontrar
          total_expenses: d.total_expenses,
          total_income: d.total_income,
          transaction_count: d.transaction_count,
          user_count: d.user_count,
        }));

      // Buscar coordenadas para todas as cidades
      const coordinatesMap = await getMultipleCityCoordinates(
        cityDataWithState.map(d => ({ city: d.city, state: d.state }))
      );

      // Adicionar coordenadas aos dados
      const cityDataWithCoords = cityDataWithState.map(d => {
        const key = `${d.city}-${d.state}`.toLowerCase();
        const coords = coordinatesMap.get(key);

        return {
          city: d.city,
          state: d.state,
          lat: coords?.lat || null,
          lng: coords?.lng || null,
          total_expenses: d.total_expenses,
          total_income: d.total_income,
          transaction_count: d.transaction_count,
          user_count: d.user_count,
        };
      });

      return NextResponse.json({ data: cityDataWithCoords });
    } else {
      // Para estados, retornar dados simples (sem coordenadas por enquanto)
      const stateData = data
        .filter(d => d.group && d.group.length === 2) // Only state codes (2 chars)
        .map(d => ({
          state: d.group,
          total_expenses: d.total_expenses,
          total_income: d.total_income,
          transaction_count: d.transaction_count,
          user_count: d.user_count,
        }));

      return NextResponse.json({ data: stateData });
    }
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}


