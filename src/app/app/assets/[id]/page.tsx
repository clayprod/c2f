'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AssetForm from '@/components/assets/AssetForm';
import ValuationChart from '@/components/assets/ValuationChart';
import ValuationForm from '@/components/assets/ValuationForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Asset {
  id: string;
  name: string;
  type: string;
  description?: string;
  purchase_date: string;
  purchase_price_cents: number;
  current_value_cents: number;
  location?: string;
  license_plate?: string;
  registration_number?: string;
  insurance_company?: string;
  insurance_policy_number?: string;
  insurance_expiry_date?: string;
  status: string;
  sale_date?: string;
  sale_price_cents?: number;
  depreciation_method?: string;
  depreciation_rate?: number;
  useful_life_years?: number;
  account_id?: string;
  category_id?: string;
  notes?: string;
  valuations?: any[];
}

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showValuationForm, setShowValuationForm] = useState(false);

  useEffect(() => {
    if (params && params.id) {
      fetchAsset();
      fetchData();
    }
  }, [params]);

  const fetchAsset = async () => {
    if (!params || !params.id) {
      return;
    }

    try {
      const response = await fetch(`/api/assets/${params.id}`);
      const result = await response.json();
      if (result.data) {
        setAsset(result.data);
      }
    } catch (error) {
      console.error('Error fetching asset:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar bem',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const accountsResponse = await fetch('/api/accounts');
      const accountsResult = await accountsResponse.json();
      if (accountsResult.data) {
        setAccounts(accountsResult.data);
      }

      const categoriesResponse = await fetch('/api/categories');
      const categoriesResult = await categoriesResponse.json();
      if (categoriesResult.data) {
        setCategories(categoriesResult.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleUpdate = async (data: any) => {
    if (!params || !params.id) {
      return;
    }

    try {
      const response = await fetch(`/api/assets/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao atualizar bem');
      }

      toast({
        title: 'Sucesso',
        description: 'Bem atualizado com sucesso!',
      });

      setShowEditForm(false);
      fetchAsset();
    } catch (error: any) {
      throw error;
    }
  };

  const handleAddValuation = async (data: any) => {
    if (!params || !params.id) {
      return;
    }

    try {
      const response = await fetch(`/api/assets/${params.id}/valuations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao adicionar avaliação');
      }

      setShowValuationForm(false);
      fetchAsset();
    } catch (error: any) {
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!params || !params.id) {
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este bem?')) {
      return;
    }

    try {
      const response = await fetch(`/api/assets/${params.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir bem');
      }

      toast({
        title: 'Sucesso',
        description: 'Bem excluído com sucesso!',
      });

      router.push('/app/assets');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir bem',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const typeLabels: Record<string, string> = {
    real_estate: 'Imóvel',
    vehicle: 'Veículo',
    rights: 'Direitos',
    equipment: 'Equipamento',
    jewelry: 'Joia',
    other: 'Outro',
  };

  const statusLabels: Record<string, string> = {
    active: 'Ativo',
    sold: 'Vendido',
    disposed: 'Descartado',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="glass-card p-12 text-center">
        <h3 className="font-display font-semibold mb-2">Bem não encontrado</h3>
        <Link href="/app/assets" className="text-primary hover:underline">
          Voltar para lista
        </Link>
      </div>
    );
  }

  const appreciation = asset.current_value_cents - asset.purchase_price_cents;
  const appreciationPercent = asset.purchase_price_cents > 0
    ? ((appreciation / asset.purchase_price_cents) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/app/assets" className="text-primary hover:underline text-sm mb-2 inline-block">
            ← Voltar para lista
          </Link>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{asset.name}</h1>
          <p className="text-muted-foreground">{typeLabels[asset.type] || asset.type}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEditForm(true)}>
            <i className='bx bx-edit'></i>
            Editar
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <i className='bx bx-trash'></i>
            Excluir
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="text-sm text-muted-foreground mb-2">Valor Atual</div>
          <p className="font-display text-2xl font-bold">
            {formatCurrency(asset.current_value_cents || asset.purchase_price_cents)}
          </p>
        </div>
        <div className="glass-card p-5">
          <div className="text-sm text-muted-foreground mb-2">Valor de Compra</div>
          <p className="font-display text-2xl font-bold text-muted-foreground">
            {formatCurrency(asset.purchase_price_cents)}
          </p>
        </div>
        <div className="glass-card p-5">
          <div className="text-sm text-muted-foreground mb-2">Valorização</div>
          <p className={`font-display text-2xl font-bold ${
            appreciation >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {appreciation >= 0 ? '+' : ''}{formatCurrency(appreciation)} ({appreciationPercent}%)
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="font-semibold mb-4">Informações Gerais</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">{statusLabels[asset.status] || asset.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data de Compra:</span>
              <span className="font-medium">{formatDate(asset.purchase_date)}</span>
            </div>
            {asset.location && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Localização:</span>
                <span className="font-medium">{asset.location}</span>
              </div>
            )}
            {asset.license_plate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Placa:</span>
                <span className="font-medium">{asset.license_plate}</span>
              </div>
            )}
            {asset.registration_number && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registro:</span>
                <span className="font-medium">{asset.registration_number}</span>
              </div>
            )}
            {asset.status === 'sold' && asset.sale_date && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data de Venda:</span>
                  <span className="font-medium">{formatDate(asset.sale_date)}</span>
                </div>
                {asset.sale_price_cents && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor de Venda:</span>
                    <span className="font-medium">{formatCurrency(asset.sale_price_cents)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-semibold mb-4">Seguro</h2>
          {asset.insurance_company ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seguradora:</span>
                <span className="font-medium">{asset.insurance_company}</span>
              </div>
              {asset.insurance_policy_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Apólice:</span>
                  <span className="font-medium">{asset.insurance_policy_number}</span>
                </div>
              )}
              {asset.insurance_expiry_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vencimento:</span>
                  <span className="font-medium">{formatDate(asset.insurance_expiry_date)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma informação de seguro cadastrada</p>
          )}
        </div>
      </div>

      {/* Depreciação */}
      {asset.depreciation_method && asset.depreciation_method !== 'none' && (
        <div className="glass-card p-6">
          <h2 className="font-semibold mb-4">Depreciação</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Método:</span>
              <span className="font-medium">
                {asset.depreciation_method === 'linear' ? 'Linear' : 'Saldo Decrescente'}
              </span>
            </div>
            {asset.depreciation_rate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxa Anual:</span>
                <span className="font-medium">{asset.depreciation_rate}%</span>
              </div>
            )}
            {asset.useful_life_years && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vida Útil:</span>
                <span className="font-medium">{asset.useful_life_years} anos</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {asset.notes && (
        <div className="glass-card p-6">
          <h2 className="font-semibold mb-4">Observações</h2>
          <p className="text-sm whitespace-pre-wrap">{asset.notes}</p>
        </div>
      )}

      {/* Valuation Chart */}
      <ValuationChart
        valuations={asset.valuations || []}
        purchaseDate={asset.purchase_date}
        purchasePriceCents={asset.purchase_price_cents}
      />

      {/* Valuation History */}
      {asset.valuations && asset.valuations.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Histórico de Avaliações</h2>
            <Button onClick={() => setShowValuationForm(true)}>
              <i className='bx bx-plus'></i>
              Nova Avaliação
            </Button>
          </div>
          <div className="space-y-3">
            {asset.valuations.map((valuation: any) => (
              <div key={valuation.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div>
                  <div className="font-medium">{formatCurrency(valuation.value_cents)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(valuation.valuation_date)} - {
                      valuation.valuation_type === 'manual' ? 'Manual' :
                      valuation.valuation_type === 'depreciation' ? 'Depreciação' : 'Mercado'
                    }
                  </div>
                  {valuation.notes && (
                    <div className="text-sm text-muted-foreground mt-1">{valuation.notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Valuation Button (if no valuations) */}
      {(!asset.valuations || asset.valuations.length === 0) && (
        <div className="glass-card p-6 text-center">
          <p className="text-muted-foreground mb-4">Nenhuma avaliação registrada</p>
          <Button onClick={() => setShowValuationForm(true)}>
            <i className='bx bx-plus'></i>
            Adicionar Primeira Avaliação
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Bem</DialogTitle>
            <DialogDescription>
              Atualize as informações do bem
            </DialogDescription>
          </DialogHeader>
          <AssetForm
            asset={asset}
            accounts={accounts}
            categories={categories}
            onSubmit={handleUpdate}
            onCancel={() => setShowEditForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Valuation Form Dialog */}
      <Dialog open={showValuationForm} onOpenChange={setShowValuationForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Avaliação</DialogTitle>
            <DialogDescription>
              Adicione uma nova avaliação ao histórico
            </DialogDescription>
          </DialogHeader>
          <ValuationForm
            assetId={asset.id}
            onSubmit={handleAddValuation}
            onCancel={() => setShowValuationForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}


