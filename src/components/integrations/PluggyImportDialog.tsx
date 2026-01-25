'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';

interface PluggyTransaction {
  id: string;
  pluggy_transaction_id: string;
  date: string;
  description: string;
  amount_cents: number;
  currency: string;
  type: string;
  category: string | null;
  account_name?: string;
  institution_name?: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
}

interface TransactionWithCategory extends PluggyTransaction {
  selected: boolean;
  category_id: string | null;
  ai_suggested: boolean;
  ai_confidence?: 'low' | 'medium' | 'high';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkId: string;
  onImportComplete?: () => void;
}

export default function PluggyImportDialog({ open, onOpenChange, linkId, onImportComplete }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectAll, setSelectAll] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/pluggy/pending-transactions?link_id=${linkId}`);
      const data = await res.json();

      const txWithCategories = (data.transactions || []).map((tx: PluggyTransaction) => ({
        ...tx,
        selected: true,
        category_id: null,
        ai_suggested: false,
      }));

      setTransactions(txWithCategories);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as transações',
      });
    } finally {
      setLoading(false);
    }
  }, [linkId, toast]);

  const categorizeWithAI = useCallback(async () => {
    if (transactions.length === 0) return;

    setCategorizing(true);
    try {
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: transactions.map(tx => ({
            id: tx.id,
            description: tx.description,
            amount: tx.amount_cents / 100,
            date: tx.date,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to categorize');
      }

      const data = await res.json();

      // Create a map of transaction ID to categorization
      const categorizationMap = new Map(
        (data.transactions || []).map((cat: any) => [cat.id, cat])
      );

      // Create a map of category name to ID
      const categoryNameMap = new Map(
        categories.map(c => [c.name.toLowerCase(), c.id])
      );

      // Update transactions with AI suggestions
      setTransactions(prev =>
        prev.map(tx => {
          const aiResult = categorizationMap.get(tx.id) as any;
          if (aiResult && aiResult.category) {
            const categoryId = categoryNameMap.get(aiResult.category.toLowerCase());
            if (categoryId) {
              return {
                ...tx,
                category_id: categoryId,
                ai_suggested: true,
                ai_confidence: aiResult.confidence,
              };
            }
          }
          return tx;
        })
      );

      toast({
        title: 'Categorização concluída',
        description: 'As transações foram categorizadas automaticamente',
      });
    } catch (error: any) {
      console.error('Error categorizing:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível categorizar as transações',
      });
    } finally {
      setCategorizing(false);
    }
  }, [transactions, categories, toast]);

  useEffect(() => {
    if (open) {
      fetchCategories();
      fetchTransactions();
    }
  }, [open, fetchCategories, fetchTransactions]);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setTransactions(prev => prev.map(tx => ({ ...tx, selected: checked })));
  };

  const handleSelectTransaction = (txId: string, checked: boolean) => {
    setTransactions(prev =>
      prev.map(tx => (tx.id === txId ? { ...tx, selected: checked } : tx))
    );
    // Update selectAll based on current state
    const allSelected = transactions.every(tx => tx.id === txId ? checked : tx.selected);
    setSelectAll(allSelected);
  };

  const handleCategoryChange = (txId: string, categoryId: string) => {
    setTransactions(prev =>
      prev.map(tx =>
        tx.id === txId ? { ...tx, category_id: categoryId, ai_suggested: false } : tx
      )
    );
  };

  const handleImport = async () => {
    const selectedTransactions = transactions.filter(tx => tx.selected);
    if (selectedTransactions.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Selecione pelo menos uma transação para importar',
      });
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/pluggy/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link_id: linkId,
          transactions: selectedTransactions.map(tx => ({
            id: tx.id,
            category_id: tx.category_id,
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao importar');
      }

      const data = await res.json();

      toast({
        title: 'Importação concluída',
        description: `${data.results.imported} transações importadas${
          data.results.skipped > 0 ? `, ${data.results.skipped} ignoradas (duplicadas)` : ''
        }`,
      });

      onOpenChange(false);
      onImportComplete?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = transactions.filter(tx => tx.selected).length;
  const categorizedCount = transactions.filter(tx => tx.category_id).length;

  const getConfidenceBadge = (confidence?: 'low' | 'medium' | 'high') => {
    if (!confidence) return null;
    const colors = {
      low: 'bg-red-500/10 text-red-500',
      medium: 'bg-yellow-500/10 text-yellow-500',
      high: 'bg-green-500/10 text-green-500',
    };
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${colors[confidence]}`}>
        IA
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="bx bx-file-plus text-primary"></i>
            Importar Transações
          </DialogTitle>
          <DialogDescription>
            Selecione as transações que deseja importar e defina as categorias
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <i className="bx bx-loader-alt bx-spin text-4xl text-primary"></i>
              <p className="mt-2 text-muted-foreground">Carregando transações...</p>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <i className="bx bx-check-circle text-4xl text-green-500"></i>
              <p className="mt-2 font-medium">Todas as transações já foram importadas!</p>
              <p className="text-sm text-muted-foreground">
                Não há transações pendentes para importar
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectAll}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                  <span className="text-sm">
                    Selecionar todas ({selectedCount}/{transactions.length})
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={categorizeWithAI}
                disabled={categorizing || transactions.length === 0}
              >
                {categorizing ? (
                  <i className="bx bx-loader-alt bx-spin mr-2"></i>
                ) : (
                  <i className="bx bx-brain mr-2"></i>
                )}
                Categorizar com IA
              </Button>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="p-2 w-10"></th>
                    <th className="p-2">Data</th>
                    <th className="p-2">Conta</th>
                    <th className="p-2">Descrição</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2">Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <Checkbox
                          checked={tx.selected}
                          onCheckedChange={(checked) =>
                            handleSelectTransaction(tx.id, !!checked)
                          }
                        />
                      </td>
                      <td className="p-2 text-sm">
                        {formatDate(tx.date)}
                      </td>
                      <td className="p-2 text-sm">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[120px]" title={tx.account_name}>
                            {tx.account_name || 'Conta'}
                          </span>
                          {tx.institution_name && (
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={tx.institution_name}>
                              {tx.institution_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]" title={tx.description}>
                            {tx.description}
                          </span>
                          {tx.ai_suggested && getConfidenceBadge(tx.ai_confidence)}
                        </div>
                      </td>
                      <td className={`p-2 text-sm text-right font-medium ${
                        tx.amount_cents >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(tx.amount_cents)}
                      </td>
                      <td className="p-2">
                        <Select
                          value={tx.category_id || ''}
                          onValueChange={(value) => handleCategoryChange(tx.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <span className="flex items-center gap-2">
                                  <span>{cat.icon}</span>
                                  <span>{cat.name}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t text-sm text-muted-foreground">
              <div>
                {selectedCount} transações selecionadas
                {categorizedCount > 0 && ` • ${categorizedCount} categorizadas`}
              </div>
              <div className="text-xs">
                Transações sem categoria serão importadas como "Outros"
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || selectedCount === 0}
          >
            {importing ? (
              <i className="bx bx-loader-alt bx-spin mr-2"></i>
            ) : (
              <i className="bx bx-file-plus mr-2"></i>
            )}
            Importar {selectedCount > 0 ? `(${selectedCount})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
