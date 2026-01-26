'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BudgetBreakdownModal, type BudgetBreakdownItem } from '@/components/budgets/BudgetBreakdownModal';
import { formatCurrency, formatCurrencyValue } from '@/lib/utils';

interface InlineBudgetEditorProps {
  budgetId?: string;
  categoryId: string;
  categoryName: string;
  currentValue?: number; // in reais
  minimumValue?: number; // in reais - minimum allowed based on auto contributions
  month: string; // YYYY-MM format
  onSave: (value: number) => Promise<void>;
  onSaveBreakdown?: (items: BudgetBreakdownItem[]) => Promise<void>;
  onCancel?: () => void;
  mode: 'create' | 'edit';
  isReadOnly?: boolean;
  readOnlyMessage?: string;
  metadata?: Record<string, any> | null;
}

function getBreakdownItemsFromMetadata(metadata: any): BudgetBreakdownItem[] {
  const items = metadata?.budget_breakdown?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((it: any) => ({
      id: it?.id,
      label: String(it?.label || ''),
      amount_cents: Math.max(0, Math.round(Number(it?.amount_cents || 0))),
    }))
    .filter((it: BudgetBreakdownItem) => it.label.trim().length > 0 && it.amount_cents > 0);
}

// Usa formatCurrency de @/lib/utils como alias para manter compatibilidade
const formatCurrencyFromCents = formatCurrency;

export function InlineBudgetEditor({
  budgetId,
  categoryId,
  categoryName,
  currentValue = 0,
  minimumValue = 0,
  month,
  onSave,
  onSaveBreakdown,
  onCancel,
  mode,
  isReadOnly = false,
  readOnlyMessage = 'Gerado automaticamente',
  metadata = null,
}: InlineBudgetEditorProps) {
  const [isEditing, setIsEditing] = useState(mode === 'create');
  // In create mode, start with empty value; in edit mode, show current value
  const [value, setValue] = useState(mode === 'create' ? '' : currentValue.toString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const existingBreakdownItems = getBreakdownItemsFromMetadata(metadata);
  const hasExistingBreakdown = existingBreakdownItems.length > 0;

  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [draftBreakdownItems, setDraftBreakdownItems] = useState<BudgetBreakdownItem[]>([]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Usar preventScroll para evitar que o focus cause scroll na página
      inputRef.current.focus({ preventScroll: true });
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    // Only update value in edit mode, keep create mode empty
    if (mode === 'edit') {
      setValue(currentValue.toString());
    }
  }, [currentValue, mode]);

  const handleStartEdit = () => {
    if (hasExistingBreakdown) return; // force_subs
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setValue(currentValue.toString());
    setIsEditing(false);
    setError(null);
    if (onCancel) {
      onCancel();
    }
  };

  const handleSave = async () => {
    const numValue = parseFloat(value.replace(',', '.'));

    if (isNaN(numValue) || numValue <= 0) {
      setError('Valor deve ser maior que zero');
      return;
    }

    // Validate minimum value
    if (minimumValue > 0 && numValue < minimumValue) {
      setError(`Valor mínimo é ${formatCurrencyValue(minimumValue)} devido a contribuições automáticas`);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(numValue);
      setIsEditing(false);
    } catch (err: any) {
      // Check if error contains minimum information
      if (err.minimum_amount) {
        setError(`Valor mínimo é ${formatCurrencyValue(err.minimum_amount)}. ${err.suggestion || ''}`);
      } else {
        setError(err.message || 'Erro ao salvar');
      }
      toast({
        title: 'Erro',
        description: err.error || err.message || 'Erro ao salvar orçamento',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBreakdown = async (items: BudgetBreakdownItem[]) => {
    if (!onSaveBreakdown) {
      toast({
        title: 'Erro',
        description: 'Este orçamento não suporta detalhamento nesta tela.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSaveBreakdown(items);
      setDraftBreakdownItems([]);
      setIsEditing(false);
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.error || err.message || 'Erro ao salvar orçamento detalhado',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearBreakdown = async () => {
    if (!onSaveBreakdown) return;
    try {
      setSaving(true);
      setError(null);
      await onSaveBreakdown([]);
      setDraftBreakdownItems([]);
      // allow editing direct after clearing
      setIsEditing(true);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const minimumCents = Math.round((minimumValue || 0) * 100);
  const breakdownTotalCents = (hasExistingBreakdown ? existingBreakdownItems : draftBreakdownItems).reduce(
    (sum, it) => sum + (it.amount_cents || 0),
    0
  );

  if (!isEditing && mode === 'edit') {
    return (
      <div className="flex items-center gap-2 group">
        {hasExistingBreakdown ? (
          <>
            <span className="font-medium" title="Orçamento detalhado por sub-itens">
              {formatCurrencyFromCents(breakdownTotalCents)}
            </span>
            {!isReadOnly ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBreakdownOpen(true)}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Editar subs"
              >
                <i className="bx bx-list-ul text-xs"></i>
              </Button>
            ) : (
              <i
                className="bx bx-lock text-xs text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity"
                title={readOnlyMessage}
              ></i>
            )}
          </>
        ) : (
          <>
            <span
              className={`font-medium transition-colors ${!isReadOnly ? 'cursor-pointer hover:text-primary' : ''}`}
              onDoubleClick={!isReadOnly ? handleStartEdit : undefined}
              title={isReadOnly ? readOnlyMessage : 'Clique duplo para editar'}
            >
              {formatCurrencyValue(currentValue)}
            </span>
            {!isReadOnly ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartEdit}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Editar valor"
                >
                  <i className="bx bx-edit text-xs"></i>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBreakdownOpen(true)}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Adicionar subs"
                >
                  <i className="bx bx-list-ul text-xs"></i>
                </Button>
              </>
            ) : (
              <i
                className="bx bx-lock text-xs text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity"
                title={readOnlyMessage}
              ></i>
            )}
          </>
        )}

        <BudgetBreakdownModal
          open={breakdownOpen}
          onOpenChange={setBreakdownOpen}
          title={`Subs — ${categoryName || 'Categoria'}`}
          initialItems={existingBreakdownItems}
          minimumCents={minimumCents}
          onSave={handleSaveBreakdown}
          onClear={hasExistingBreakdown ? handleClearBreakdown : undefined}
          saving={saving}
        />
      </div>
    );
  }

  if (isReadOnly && mode === 'create') {
    return (
      <span className="text-[10px] text-muted-foreground bg-muted/30 px-2 py-1 rounded text-center border border-dashed border-border/50 inline-flex items-center gap-1">
        <i className="bx bx-lock"></i>
        <span className="hidden sm:inline">Auto</span>
      </span>
    );
  }

  // Compact version for create mode
  if (mode === 'create') {
    return (
      <div className="flex items-center gap-0.5 sm:gap-1">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] sm:text-xs">R$</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              const newValue = e.target.value.replace(/[^\d,.-]/g, '');
              setValue(newValue);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={`w-full pl-6 sm:pl-7 pr-1 sm:pr-2 py-1 sm:py-1.5 text-xs sm:text-sm rounded bg-muted/50 border ${
              error ? 'border-red-500' : 'border-border'
            } focus:border-primary focus:outline-none transition-colors`}
            placeholder="0,00"
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={
            saving ||
            !value ||
            parseFloat(value.replace(',', '.')) <= 0
          }
          size="sm"
          className="h-6 w-6 sm:h-7 sm:w-7 p-0 flex-shrink-0"
          title="Salvar (Enter)"
        >
          {saving ? (
            <i className="bx bx-loader-alt bx-spin text-[10px] sm:text-xs"></i>
          ) : (
            <i className="bx bx-check text-[10px] sm:text-xs"></i>
          )}
        </Button>
        <Button
          onClick={() => setBreakdownOpen(true)}
          disabled={saving || !onSaveBreakdown}
          variant="ghost"
          size="sm"
          className="h-6 w-6 sm:h-7 sm:w-7 p-0 flex-shrink-0"
          title="Detalhar em subs"
        >
          <i className="bx bx-list-ul text-[10px] sm:text-xs"></i>
        </Button>
        {error && (
          <span className="absolute -bottom-4 left-0 text-[10px] text-negative whitespace-nowrap">{error}</span>
        )}

        <BudgetBreakdownModal
          open={breakdownOpen}
          onOpenChange={setBreakdownOpen}
          title={`Subs — ${categoryName || 'Categoria'}`}
          initialItems={draftBreakdownItems}
          minimumCents={minimumCents}
          onSave={async (items) => {
            setDraftBreakdownItems(items);
            await handleSaveBreakdown(items);
          }}
          onClear={draftBreakdownItems.length > 0 ? async () => setDraftBreakdownItems([]) : undefined}
          saving={saving}
        />
      </div>
    );
  }

  // Edit mode - expanded
  if (hasExistingBreakdown) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" title="Orçamento detalhado por sub-itens">
          {formatCurrencyFromCents(breakdownTotalCents)}
        </span>
        <Button
          onClick={() => setBreakdownOpen(true)}
          disabled={saving || isReadOnly}
          size="sm"
          className="h-7 px-2"
          title="Editar subs"
        >
          <i className="bx bx-list-ul text-xs mr-1"></i>
          Subs
        </Button>
        <BudgetBreakdownModal
          open={breakdownOpen}
          onOpenChange={setBreakdownOpen}
          title={`Subs — ${categoryName || 'Categoria'}`}
          initialItems={existingBreakdownItems}
          minimumCents={minimumCents}
          onSave={handleSaveBreakdown}
          onClear={handleClearBreakdown}
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <div className="flex-1">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => {
                const newValue = e.target.value.replace(/[^\d,.-]/g, '');
                setValue(newValue);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={saving}
              className={`w-full pl-7 pr-2 py-1.5 text-sm rounded bg-muted/50 border ${
                error ? 'border-red-500' : 'border-border'
              } focus:border-primary focus:outline-none transition-colors`}
              placeholder="0,00"
            />
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !value || parseFloat(value.replace(',', '.')) <= 0}
          size="sm"
          className="h-7 w-7 p-0"
          title="Salvar (Enter)"
        >
          {saving ? (
            <i className="bx bx-loader-alt bx-spin text-xs"></i>
          ) : (
            <i className="bx bx-check text-xs"></i>
          )}
        </Button>
        <Button
          onClick={handleCancel}
          disabled={saving}
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Cancelar (ESC)"
        >
          <i className="bx bx-x text-xs"></i>
        </Button>
      </div>
      {error && (
        <p className="text-[10px] text-negative">{error}</p>
      )}
      {minimumValue > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Mín: {formatCurrencyValue(minimumValue)}
        </p>
      )}
    </div>
  );
}
