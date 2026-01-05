'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  source_type?: string | null;
  is_active?: boolean;
}

interface CategoryWithTransactions extends Category {
  transaction_count: number;
}

interface CategoryMigrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceCategory: CategoryWithTransactions;
  onSuccess: () => void;
}

export function CategoryMigrationModal({
  open,
  onOpenChange,
  sourceCategory,
  onSuccess,
}: CategoryMigrationModalProps) {
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchAvailableCategories();
    }
  }, [open, sourceCategory]);

  const fetchAvailableCategories = async () => {
    try {
      setLoadingCategories(true);
      const res = await fetch(`/api/categories?type=${sourceCategory.type}&include_inactive=false`);
      const data = await res.json();
      
      // Filter out the source category itself
      const filtered = (data.data || []).filter(
        (cat: Category) => cat.id !== sourceCategory.id && cat.is_active !== false
      );
      
      setAvailableCategories(filtered);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as categorias disponíveis',
        variant: 'destructive',
      });
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleMigrate = async () => {
    if (!targetCategoryId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma categoria destino',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/categories/${sourceCategory.id}/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_category_id: targetCategoryId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao migrar transações');
      }

      toast({
        title: 'Sucesso',
        description: `${data.data.transactionsMigrated} transação(ões) migrada(s) com sucesso`,
      });

      onSuccess();
      onOpenChange(false);
      setTargetCategoryId('');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao migrar transações',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = availableCategories.find(cat => cat.id === targetCategoryId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Migrar Transações</DialogTitle>
          <DialogDescription>
            Migre todas as transações da categoria "{sourceCategory.name}" para outra categoria.
            Após a migração, você poderá excluir esta categoria se desejar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="glass-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: (sourceCategory.color || '#3b82f6') + '20' }}
              >
                {sourceCategory.icon || '📁'}
              </div>
              <div>
                <p className="font-medium">{sourceCategory.name}</p>
                <p className="text-sm text-muted-foreground">
                  {sourceCategory.transaction_count} transação(ões) serão migradas
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Categoria Destino *
            </label>
            {loadingCategories ? (
              <div className="px-3 py-2 border rounded-md text-sm text-muted-foreground">
                Carregando categorias...
              </div>
            ) : availableCategories.length === 0 ? (
              <div className="px-3 py-2 border rounded-md text-sm text-muted-foreground">
                Nenhuma categoria disponível para migração
              </div>
            ) : (
              <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria destino" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <span>{category.icon || '📁'}</span>
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedCategory && (
            <div className="glass-card p-4 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: (selectedCategory.color || '#3b82f6') + '20' }}
                >
                  {selectedCategory.icon || '📁'}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Transações serão migradas para: {selectedCategory.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Esta ação não pode ser desfeita
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleMigrate}
            disabled={loading || !targetCategoryId || availableCategories.length === 0}
          >
            {loading ? 'Migrando...' : 'Migrar Transações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

