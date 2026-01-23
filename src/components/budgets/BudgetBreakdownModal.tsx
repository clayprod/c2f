'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CurrencyInput } from '@/components/ui/currency-input';
import { formatCurrency } from '@/lib/utils';

export type BudgetBreakdownItem = {
  id?: string;
  label: string;
  amount_cents: number;
};

// Usa formatCurrency de @/lib/utils como alias para manter compatibilidade
const formatCurrencyFromCents = formatCurrency;

function normalizeItems(items: BudgetBreakdownItem[]) {
  return (items || []).map((it) => ({
    id: it.id,
    label: it.label || '',
    amount_cents: Math.max(0, Math.round(it.amount_cents || 0)),
  }));
}

export interface BudgetBreakdownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  initialItems: BudgetBreakdownItem[];
  minimumCents?: number;
  onSave: (items: BudgetBreakdownItem[]) => Promise<void> | void;
  onClear?: () => Promise<void> | void;
  saving?: boolean;
}

export function BudgetBreakdownModal({
  open,
  onOpenChange,
  title = 'Detalhar orçamento',
  description = 'Adicione sub-itens que somam o valor do orçamento.',
  initialItems,
  minimumCents = 0,
  onSave,
  onClear,
  saving = false,
}: BudgetBreakdownModalProps) {
  const [items, setItems] = useState<BudgetBreakdownItem[]>(() => normalizeItems(initialItems));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setItems(normalizeItems(initialItems));
      setError(null);
    }
  }, [open, initialItems]);

  const totalCents = useMemo(
    () => items.reduce((sum, it) => sum + Math.round(it.amount_cents || 0), 0),
    [items]
  );

  const canSave = items.length > 0 && items.every((it) => it.label.trim().length > 0 && it.amount_cents > 0);

  const handleAdd = () => {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setItems((prev) => [...prev, { id, label: '', amount_cents: 0 }]);
  };

  const handleRemove = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setError(null);

    const cleaned = items
      .map((it) => ({ ...it, label: it.label.trim(), amount_cents: Math.round(it.amount_cents || 0) }))
      .filter((it) => it.label.length > 0 && it.amount_cents > 0);

    if (cleaned.length === 0) {
      setError('Adicione pelo menos 1 sub-item com nome e valor.');
      return;
    }

    const total = cleaned.reduce((sum, it) => sum + it.amount_cents, 0);
    if (minimumCents > 0 && total < minimumCents) {
      setError(`Valor mínimo é ${formatCurrencyFromCents(minimumCents)} devido a contribuições automáticas.`);
      return;
    }

    await onSave(cleaned);
    onOpenChange(false);
  };

  const handleClear = async () => {
    setError(null);
    await onClear?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted/30 border border-dashed border-border/50 rounded-lg p-3">
              Nenhum sub-item. Clique em “Adicionar sub-item”.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={it.id || idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={it.label}
                    onChange={(e) => {
                      const next = e.target.value;
                      setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, label: next } : p)));
                      setError(null);
                    }}
                    placeholder="Ex: Mercado, Streaming..."
                    className="flex-1 px-3 py-2 text-sm rounded-md bg-muted/50 border border-border focus:border-primary focus:outline-none"
                    disabled={saving}
                  />
                  <div className="w-36">
                    <CurrencyInput
                      value={it.amount_cents}
                      convertToCents
                      allowEmpty
                      onValueChange={(val) => {
                        setItems((prev) =>
                          prev.map((p, i) =>
                            i === idx ? { ...p, amount_cents: Math.max(0, Math.round(val || 0)) } : p
                          )
                        );
                        setError(null);
                      }}
                      className="text-sm"
                      disabled={saving}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    title="Remover"
                    onClick={() => handleRemove(idx)}
                    disabled={saving}
                  >
                    <i className="bx bx-trash text-sm"></i>
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-sm bg-muted/30 border border-border/50 rounded-lg p-3">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{formatCurrencyFromCents(totalCents)}</span>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleAdd} disabled={saving}>
              <i className="bx bx-plus-circle mr-1"></i>
              Adicionar sub-item
            </Button>

            <div className="flex gap-2">
              {onClear && (
                <Button type="button" variant="ghost" onClick={handleClear} disabled={saving}>
                  Remover subs
                </Button>
              )}
              <Button type="button" className="btn-primary" onClick={handleSave} disabled={saving || !canSave}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

