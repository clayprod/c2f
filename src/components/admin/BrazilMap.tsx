'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrencyValue } from '@/lib/utils';

// Tipos para os componentes do react-simple-maps
type MapsModule = {
  ComposableMap: React.ComponentType<any>;
  Geographies: React.ComponentType<any>;
  Geography: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
};

interface StateMapData {
  state: string;
  total_expenses: number;
  total_income: number;
  transaction_count: number;
  user_count: number;
}

interface CityMapData extends StateMapData {
  city: string;
  lat: number | null;
  lng: number | null;
}

type MapData = StateMapData | CityMapData;

// URL do TopoJSON do Brasil (estados) - usando gist confiável
const BRAZIL_TOPOLOGY_URL = 'https://gist.githubusercontent.com/ruliana/1ccaaab05ea113b0dff3b22be3b4d637/raw/br-states.json';

export default function BrazilMap() {
  const [groupBy, setGroupBy] = useState<'state' | 'city'>('state');
  const [data, setData] = useState<MapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState<string>('');
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [mapsModule, setMapsModule] = useState<MapsModule | null>(null);

  // Carregar react-simple-maps apenas no cliente
  useEffect(() => {
    import('react-simple-maps').then((module) => {
      setMapsModule({
        ComposableMap: module.ComposableMap,
        Geographies: module.Geographies,
        Geography: module.Geography,
        Marker: module.Marker,
      });
    }).catch((err) => {
      console.error('Error loading react-simple-maps:', err);
      setError('Erro ao carregar biblioteca de mapas');
    });
  }, []);

  useEffect(() => {
    if (mapsModule) {
      fetchMapData();
    }
  }, [groupBy, mapsModule]);

  const fetchMapData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/map-data?group_by=${groupBy}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch map data');
      }
      const result = await res.json();
      setData(result.data || []);
    } catch (error) {
      console.error('Error fetching map data:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar dados do mapa');
    } finally {
      setLoading(false);
    }
  };

  // Alias para manter compatibilidade
  const formatCurrency = formatCurrencyValue;

  // Calcular valores máximos para escala de cores
  const maxExpenses = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map(d => d.total_expenses));
  }, [data]);

  // Função para obter cor baseada no valor
  const getColor = (value: number) => {
    const intensity = Math.min(value / maxExpenses, 1);
    const hue = 0; // Vermelho para despesas
    const saturation = 70;
    const lightness = 100 - intensity * 40; // Mais escuro = mais gastos
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  // Função para obter tamanho do marcador baseado no valor
  const getMarkerSize = (value: number) => {
    const maxValue = maxExpenses;
    const minSize = 3;
    const maxSize = 12;
    const ratio = value / maxValue;
    return minSize + (maxSize - minSize) * Math.min(ratio, 1);
  };

  const isCityData = (item: MapData): item is CityMapData => {
    return 'city' in item && 'lat' in item && 'lng' in item;
  };

  const cityData = useMemo(() => {
    return data.filter(isCityData).filter(d => d.lat !== null && d.lng !== null) as CityMapData[];
  }, [data]);

  const stateData = useMemo(() => {
    return data.filter(d => !isCityData(d)) as StateMapData[];
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Mapa do Brasil - Visualização Geográfica</CardTitle>
          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as 'state' | 'city')}>
            <TabsList>
              <TabsTrigger value="state">Por Estado</TabsTrigger>
              <TabsTrigger value="city">Por Cidade</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {!mapsModule ? (
          <div className="text-center py-8">Carregando biblioteca de mapas...</div>
        ) : loading ? (
          <div className="text-center py-8">Carregando mapa...</div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            <p>Erro ao carregar dados do mapa</p>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
          </div>
        ) : (() => {
          const { ComposableMap, Geographies, Geography, Marker } = mapsModule;
          return (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {groupBy === 'state' 
                  ? 'Visualização dos gastos agregados por estado. Passe o mouse sobre os estados para ver detalhes.'
                  : 'Visualização dos gastos agregados por cidade. Passe o mouse sobre os marcadores para ver detalhes.'}
              </div>

              <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-muted/20">
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{
                    scale: 800,
                    center: [-55, -15],
                  }}
                  style={{ width: '100%', height: '100%' }}
                >
                  {/* Renderizar estados do Brasil */}
                  <Geographies geography={BRAZIL_TOPOLOGY_URL}>
                    {({ geographies }: any) =>
                      geographies.map((geo: any) => {
                        // O código do estado está no campo 'id' do TopoJSON (ex: "SP", "RJ")
                        const stateCode = geo.id ||
                                         geo.properties?.sigla ||
                                         geo.properties?.UF ||
                                         '';
                        const stateName = geo.properties?.nome || '';
                        const stateInfo = stateData.find(d => d.state === stateCode || d.state === stateCode.toUpperCase());
                        
                        return (
                          <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={stateInfo ? getColor(stateInfo.total_expenses) : '#E5E7EB'}
                          stroke="#FFFFFF"
                          strokeWidth={0.5}
                          style={{
                            default: {
                              outline: 'none',
                            },
                            hover: {
                              outline: 'none',
                              stroke: '#3B82F6',
                              strokeWidth: 2,
                              cursor: 'pointer',
                            },
                            pressed: {
                              outline: 'none',
                            },
                          }}
                          onMouseEnter={(e: React.MouseEvent<SVGElement>) => {
                            if (groupBy === 'state') {
                              const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
                              setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
                              if (stateInfo) {
                                setTooltipContent(
                                  `${stateName} (${stateCode})\n` +
                                  `Despesas: ${formatCurrency(stateInfo.total_expenses)}\n` +
                                  `Receitas: ${formatCurrency(stateInfo.total_income)}\n` +
                                  `Transações: ${stateInfo.transaction_count}\n` +
                                  `Usuários: ${stateInfo.user_count}`
                                );
                              } else {
                                setTooltipContent(`${stateName} (${stateCode})\nSem dados`);
                              }
                            }
                          }}
                          onMouseLeave={() => {
                            setTooltipContent('');
                            setTooltipPosition(null);
                          }}
                          />
                        );
                      })
                    }
                  </Geographies>

                  {/* Renderizar marcadores de cidades */}
                  {groupBy === 'city' && cityData.map((city, index) => {
                    if (city.lat === null || city.lng === null) return null;
                    
                    return (
                      <Marker
                      key={`${city.city}-${city.state}-${index}`}
                      coordinates={[city.lng, city.lat]}
                      onMouseEnter={(e: React.MouseEvent<SVGElement>) => {
                        const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
                        setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
                        setTooltipContent(
                          `${city.city}, ${city.state}\n` +
                          `Despesas: ${formatCurrency(city.total_expenses)}\n` +
                          `Receitas: ${formatCurrency(city.total_income)}\n` +
                          `Transações: ${city.transaction_count}\n` +
                          `Usuários: ${city.user_count}`
                        );
                      }}
                      onMouseLeave={() => {
                        setTooltipContent('');
                        setTooltipPosition(null);
                      }}
                    >
                      <circle
                        r={getMarkerSize(city.total_expenses)}
                        fill={getColor(city.total_expenses)}
                        stroke="#FFFFFF"
                        strokeWidth={1}
                        style={{ cursor: 'pointer' }}
                        />
                      </Marker>
                    );
                  })}
                </ComposableMap>
              </div>

              {/* Tooltip flutuante */}
              {tooltipContent && tooltipPosition && (
                <div
                  className="fixed z-50 px-3 py-2 text-sm bg-popover text-popover-foreground border rounded-md shadow-md pointer-events-none whitespace-pre-line"
                  style={{
                    left: `${tooltipPosition.x}px`,
                    top: `${tooltipPosition.y}px`,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  {tooltipContent}
                </div>
              )}

              {/* Legenda */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Legenda:</span>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: getColor(0) }} />
                    <span className="text-xs">Menor</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: getColor(maxExpenses) }} />
                    <span className="text-xs">Maior</span>
                  </div>
                </div>
                <div className="text-muted-foreground">
                  Total de {groupBy === 'state' ? 'estados' : 'cidades'}: {data.length}
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}


