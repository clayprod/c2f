'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TransactionForm from '@/components/transactions/TransactionForm';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

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
  assigned_to_profile?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

interface AssetCardProps {
  asset: Asset;
}

const typeIcons: Record<string, string> = {
  real_estate: '🏠',
  vehicle: '🚗',
  rights: '📜',
  equipment: '⚙️',
  jewelry: '💎',
  other: '📦',
};

const typeLabels: Record<string, string> = {
  real_estate: 'Imóvel',
  vehicle: 'Veículo',
  rights: 'Direitos',
  equipment: 'Equipamento',
  jewelry: 'Joia',
  other: 'Outro',
};

const statusColors: Record<string, string> = {
  active: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  sold: 'bg-green-500/10 text-green-500 border-green-500/20',
  disposed: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  sold: 'Vendido',
  disposed: 'Descartado',
};

export default function AssetCard({ asset }: AssetCardProps) {
  const [showSellDialog, setShowSellDialog] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (showSellDialog) {
      fetchData();
    }
  }, [showSellDialog]);

  const fetchData = async () => {
    try {
      const [accountsRes, categoriesRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/categories'),
      ]);
      const accountsData = await accountsRes.json();
      const categoriesData = await categoriesRes.json();
      if (accountsData.data) setAccounts(accountsData.data);
      if (categoriesData.data) setCategories(categoriesData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleSellTransaction = async (data: any) => {
    try {
      setLoading(true);
      // Create transaction
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar transação');
      }

      // Update asset status to 'sold'
      const updateResponse = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'sold',
          sale_date: data.posted_at,
          sale_price_cents: data.amount_cents ? Math.abs(data.amount_cents) : undefined,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Erro ao atualizar status do bem');
      }

      setShowSellDialog(false);
      // Reload page to reflect changes
      window.location.reload();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao processar venda",
        description: error.message || "Ocorreu um erro ao tentar processar a venda do bem",
      });
    } finally {
      setLoading(false);
    }
  };

  const appreciation = asset.current_value_cents - asset.purchase_price_cents;
  const appreciationPercent = asset.purchase_price_cents > 0
    ? ((appreciation / asset.purchase_price_cents) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
            {typeIcons[asset.type] || '📦'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display font-semibold text-lg">{asset.name}</h3>
              <span className={`badge-pill text-xs ${statusColors[asset.status]}`}>
                {statusLabels[asset.status]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              {typeLabels[asset.type]}
            </p>
            {asset.location && (
              <p className="text-sm text-muted-foreground">
                📍 {asset.location}
              </p>
            )}
            {asset.license_plate && (
              <p className="text-sm text-muted-foreground">
                🚗 {asset.license_plate}
              </p>
            )}
            {asset.assigned_to_profile && (
              <div className="flex items-center gap-2 mt-2">
                {asset.assigned_to_profile.avatar_url ? (
                  <img
                    src={asset.assigned_to_profile.avatar_url}
                    alt={asset.assigned_to_profile.full_name || 'Avatar'}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                    {(asset.assigned_to_profile.full_name || asset.assigned_to_profile.email)[0].toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-muted-foreground">
                  Responsável: {asset.assigned_to_profile.full_name || asset.assigned_to_profile.email}
                </span>
              </div>
            )}
          </div>
        </div>
        <Link
          href={`/app/assets/${asset.id}`}
          className="text-primary hover:underline text-sm"
        >
          Ver detalhes
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Valor Atual</p>
          <p className="font-semibold text-lg">
            {formatCurrency(asset.current_value_cents)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Valor de Compra</p>
          <p className="font-semibold text-muted-foreground">
            {formatCurrency(asset.purchase_price_cents)}
          </p>
        </div>
      </div>

      {asset.status === 'active' && (
        <div className="pt-4 border-t border-border/50 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Valorização</span>
            <span className={`font-medium ${appreciation >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {appreciation >= 0 ? '+' : ''}{formatCurrency(appreciation)} ({appreciationPercent}%)
            </span>
          </div>
          <Button
            onClick={() => setShowSellDialog(true)}
            className="w-full"
            variant="outline"
          >
            <i className='bx bx-money'></i>
            Vender
          </Button>
        </div>
      )}

      {/* Sell Dialog */}
      <Dialog open={showSellDialog} onOpenChange={setShowSellDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vender Bem</DialogTitle>
          </DialogHeader>
          <TransactionForm
            open={showSellDialog}
            onOpenChange={setShowSellDialog}
            onSubmit={handleSellTransaction}
            accounts={accounts}
            categories={categories}
            transaction={{
              account_id: asset.account_id || '',
              category_id: categories.find(c => c.name === 'VENDA DE ATIVOS' && c.type === 'income')?.id || '',
              posted_at: format(new Date(), 'yyyy-MM-dd'),
              description: `Venda: ${asset.name}`,
              amount: asset.current_value_cents, // Positive value triggers income type
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}


