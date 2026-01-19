'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AssetCard from '@/components/assets/AssetCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlanGuard } from '@/components/app/PlanGuard';

interface Asset {
  id: string;
  name: string;
  type: 'real_estate' | 'vehicle' | 'rights' | 'equipment' | 'jewelry' | 'other';
  description?: string;
  purchase_price_cents: number;
  current_value_cents: number;
  status: 'active' | 'sold' | 'disposed';
  location?: string;
  license_plate?: string;
  last_valuation_date?: string;
  account_id?: string;
  category_id?: string;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchAssets();
  }, [typeFilter, statusFilter]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/assets?${params.toString()}`);
      const result = await response.json();
      if (result.data) {
        setAssets(result.data);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const activeAssets = assets.filter(a => a.status === 'active');
  const totalPatrimony = activeAssets.reduce((sum, a) => sum + (a.current_value_cents || a.purchase_price_cents), 0);
  const totalPurchaseValue = activeAssets.reduce((sum, a) => sum + a.purchase_price_cents, 0);
  const totalAppreciation = totalPatrimony - totalPurchaseValue;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <PlanGuard minPlan="pro">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Patrimônio</h1>
            <p className="text-muted-foreground">Gerencie seus bens móveis e imóveis</p>
          </div>
          <Link href="/app/assets/new" className="btn-primary">
            <i className='bx bx-plus'></i>
            Novo Bem
          </Link>
        </div>

        {/* Summary */}
        {activeAssets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <i className='bx bx-home-alt text-xl text-primary'></i>
                </div>
                <span className="text-sm text-muted-foreground">Total de Bens</span>
              </div>
              <p className="font-display text-2xl font-bold">{activeAssets.length}</p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <i className='bx bx-coin-stack text-xl text-green-500'></i>
                </div>
                <span className="text-sm text-muted-foreground">Patrimônio Total</span>
              </div>
              <p className="font-display text-2xl font-bold">{formatCurrency(totalPatrimony)}</p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalAppreciation >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}>
                  <i className={`bx ${totalAppreciation >= 0 ? 'bx-trending-up' : 'bx-trending-down'} text-xl ${totalAppreciation >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}></i>
                </div>
                <span className="text-sm text-muted-foreground">Valorização</span>
              </div>
              <p className={`font-display text-2xl font-bold ${totalAppreciation >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                {totalAppreciation >= 0 ? '+' : ''}{formatCurrency(totalAppreciation)}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        {assets.length > 0 && (
          <div className="flex gap-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="real_estate">Imóveis</SelectItem>
                <SelectItem value="vehicle">Veículos</SelectItem>
                <SelectItem value="rights">Direitos</SelectItem>
                <SelectItem value="equipment">Equipamentos</SelectItem>
                <SelectItem value="jewelry">Joias</SelectItem>
                <SelectItem value="other">Outros</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="sold">Vendidos</SelectItem>
                <SelectItem value="disposed">Descartados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {assets.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <i className='bx bx-home-alt text-4xl text-muted-foreground mb-4'></i>
            <h3 className="font-display font-semibold mb-2">Nenhum bem cadastrado</h3>
            <p className="text-muted-foreground mb-6">
              Comece adicionando seu primeiro bem ao patrimônio
            </p>
            <Link href="/app/assets/new" className="btn-primary">
              <i className='bx bx-plus'></i>
              Adicionar Bem
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </div>
    </PlanGuard>
  );
}


