'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description?: string;
  prices: Array<{
    id: string;
    unit_amount: number;
    currency: string;
    active: boolean;
  }>;
}

export default function PriceManagement() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [updatingDescription, setUpdatingDescription] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    try {
      const res = await fetch('/api/admin/prices');
      if (!res.ok) throw new Error('Failed to fetch prices');
      const data = await res.json();
      setProducts(data.products || []);
      
      // Initialize descriptions state
      const initialDescriptions: Record<string, string> = {};
      (data.products || []).forEach((product: Product) => {
        initialDescriptions[product.id] = product.description || '';
      });
      setDescriptions(initialDescriptions);
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os preços',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async (productId: string, currentPriceId: string, planType: 'pro' | 'premium') => {
    const inputId = `price-${productId}`;
    const input = document.getElementById(inputId) as HTMLInputElement;
    if (!input) return;

    const newPriceReais = parseFloat(input.value);
    if (isNaN(newPriceReais) || newPriceReais <= 0) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Preço inválido',
      });
      return;
    }

    const newPriceCents = Math.round(newPriceReais * 100);

    setUpdating({ ...updating, [productId]: true });

    try {
      const res = await fetch('/api/admin/prices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: currentPriceId,
          product_id: productId,
          unit_amount: newPriceCents,
          currency: 'brl',
          plan_type: planType,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update price');
      }

      toast({
        title: 'Sucesso',
        description: 'Preço atualizado com sucesso. Os preços serão atualizados na página de pricing em alguns segundos.',
      });

      // Refresh prices
      await fetchPrices();
      
      // Limpar cache do pricing na API pública (opcional, mas ajuda)
      try {
        await fetch('/api/public/pricing?skipCache=true', { method: 'GET' });
      } catch (error) {
        console.warn('Failed to clear pricing cache:', error);
      }
    } catch (error: any) {
      console.error('Error updating price:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar o preço',
      });
    } finally {
      setUpdating({ ...updating, [productId]: false });
    }
  };

  const handleUpdateDescription = async (productId: string) => {
    const newDescription = descriptions[productId] || '';

    setUpdatingDescription({ ...updatingDescription, [productId]: true });

    try {
      const res = await fetch('/api/admin/prices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          description: newDescription,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update description');
      }

      toast({
        title: 'Sucesso',
        description: 'Descrição atualizada com sucesso',
      });

      // Refresh prices
      await fetchPrices();
    } catch (error: any) {
      console.error('Error updating description:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar a descrição',
      });
    } finally {
      setUpdatingDescription({ ...updatingDescription, [productId]: false });
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  if (loading) {
    return <div className="text-center py-8">Carregando preços...</div>;
  }

  const planProducts = products.filter((p) =>
    p.name.toLowerCase().includes('pro') ||
    p.name.toLowerCase().includes('business') ||
    p.name.toLowerCase().includes('premium')
  );

  return (
    <div className="space-y-6">
      {planProducts.map((product) => {
        const activePrice = product.prices.find((p) => p.active);
        const planType = product.name.toLowerCase().includes('pro') ? 'pro' : 'premium';

        if (!activePrice) return null;

        return (
          <Card key={product.id}>
            <CardHeader>
              <CardTitle>{product.name}</CardTitle>
              {product.description && (
                <CardDescription>{product.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Preço Atual</Label>
                <div className="text-2xl font-bold mt-1">
                  {formatPrice(activePrice.unit_amount)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Price ID: {activePrice.id}
                </div>
              </div>

              <div>
                <Label htmlFor={`price-${product.id}`}>Novo Preço (em R$)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id={`price-${product.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={formatPrice(activePrice.unit_amount)}
                    className="max-w-xs"
                  />
                  <Button
                    onClick={() => handleUpdatePrice(product.id, activePrice.id, planType)}
                    disabled={updating[product.id]}
                  >
                    {updating[product.id] ? 'Atualizando...' : 'Atualizar Preço'}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  O novo preço será criado no Stripe. O preço antigo será arquivado automaticamente.
                </p>
              </div>

              <div className="border-t pt-4">
                <Label htmlFor={`description-${product.id}`}>Descrição do Produto</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Esta descrição aparece na landing page e pode ser editada diretamente no Stripe.
                </p>
                <div className="space-y-2">
                  <Textarea
                    id={`description-${product.id}`}
                    value={descriptions[product.id] || ''}
                    onChange={(e) => setDescriptions({ ...descriptions, [product.id]: e.target.value })}
                    placeholder="Descrição do plano (ex: Plano Premium do c2Finance - Todas as funcionalidades + Suporte prioritário)"
                    rows={3}
                  />
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateDescription(product.id)}
                    disabled={updatingDescription[product.id]}
                  >
                    {updatingDescription[product.id] ? 'Salvando...' : 'Salvar Descrição'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}


