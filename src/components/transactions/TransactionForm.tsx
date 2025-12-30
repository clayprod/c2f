'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface Transaction {
  id?: string;
  description: string;
  amount: number | string;
  posted_at: string;
  account_id?: string;
  category_id?: string;
  notes?: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
  installment_number?: number;
  installment_total?: number;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  transaction?: Transaction;
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: string }>;
}

const formSchema = z.object({
  account_id: z.string().min(1, 'Selecione uma conta'),
  category_id: z.string().optional(),
  posted_at: z.string().min(1, 'Data é obrigatória'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.string().min(1, 'Valor é obrigatório'),
  currency: z.string().default('BRL'),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof formSchema>;

const RECURRENCE_OPTIONS = [
  { value: '', label: 'Selecione a frequência' },
  { value: 'FREQ=DAILY;INTERVAL=1', label: 'Diária' },
  { value: 'FREQ=WEEKLY;INTERVAL=1', label: 'Semanal' },
  { value: 'FREQ=MONTHLY;INTERVAL=1', label: 'Mensal' },
  { value: 'FREQ=YEARLY;INTERVAL=1', label: 'Anual' },
  { value: 'custom', label: 'Personalizada' },
];

export default function TransactionForm({
  open,
  onOpenChange,
  onSubmit,
  transaction,
  accounts,
  categories,
}: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('');
  const [customRecurrence, setCustomRecurrence] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentNumber, setInstallmentNumber] = useState('1');
  const [installmentTotal, setInstallmentTotal] = useState('1');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<TransactionFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      account_id: transaction?.account_id || '',
      category_id: transaction?.category_id || '',
      posted_at: transaction?.posted_at || new Date().toISOString().split('T')[0],
      description: transaction?.description || '',
      amount: transaction?.amount ? (typeof transaction.amount === 'string' ? transaction.amount : Math.abs(transaction.amount / 100).toFixed(2)) : '',
      currency: 'BRL',
      notes: transaction?.notes || '',
    },
  });

  const selectedAccountId = watch('account_id');
  const filteredCategories = categories;

  // Initialize state from transaction when editing
  useEffect(() => {
    if (transaction) {
      const amount = typeof transaction.amount === 'number' ? transaction.amount : parseFloat(String(transaction.amount));
      setTransactionType(amount >= 0 ? 'income' : 'expense');
      setIsRecurring(transaction.is_recurring || false);
      setIsInstallment(!!(transaction.installment_number && transaction.installment_total));
      setInstallmentNumber(String(transaction.installment_number || 1));
      setInstallmentTotal(String(transaction.installment_total || 1));

      if (transaction.recurrence_rule) {
        const matchingOption = RECURRENCE_OPTIONS.find(opt => opt.value === transaction.recurrence_rule);
        if (matchingOption) {
          setRecurrenceType(transaction.recurrence_rule);
        } else {
          setRecurrenceType('custom');
          setCustomRecurrence(transaction.recurrence_rule);
        }
      }

      reset({
        account_id: transaction.account_id,
        category_id: transaction.category_id || '',
        posted_at: transaction.posted_at,
        description: transaction.description,
        amount: typeof transaction.amount === 'string'
          ? transaction.amount
          : Math.abs(transaction.amount / 100).toFixed(2),
        currency: 'BRL',
        notes: transaction.notes || '',
      });
    } else {
      setTransactionType('expense');
      setIsRecurring(false);
      setRecurrenceType('');
      setCustomRecurrence('');
      setIsInstallment(false);
      setInstallmentNumber('1');
      setInstallmentTotal('1');
      reset({
        account_id: '',
        category_id: '',
        posted_at: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        currency: 'BRL',
        notes: '',
      });
    }
  }, [transaction, reset, open]);

  const onFormSubmit = async (data: TransactionFormData) => {
    try {
      setLoading(true);
      // Convert amount string to cents
      const amountInReais = parseFloat(data.amount.replace(/[^\d,.-]/g, '').replace(',', '.'));
      const amountCents = Math.round(Math.abs(amountInReais) * 100);

      // Determine recurrence rule
      let recurrence_rule: string | undefined;
      if (isRecurring) {
        recurrence_rule = recurrenceType === 'custom' ? customRecurrence : recurrenceType;
      }

      await onSubmit({
        ...data,
        amount_cents: amountCents,
        type: transactionType,
        is_recurring: isRecurring,
        recurrence_rule: recurrence_rule,
        installment_number: isInstallment ? parseInt(installmentNumber) : undefined,
        installment_total: isInstallment ? parseInt(installmentTotal) : undefined,
      } as any);

      onOpenChange(false);
      reset();
    } catch (error) {
      console.error('Error submitting transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction ? 'Editar Transação' : 'Nova Transação'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          {/* Transaction Type Toggle */}
          <div>
            <Label>Tipo de Transação *</Label>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setTransactionType('expense')}
                className={`flex-1 py-3 px-4 rounded-xl border transition-all ${
                  transactionType === 'expense'
                    ? 'border-red-500 bg-red-500/10 text-red-500'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <i className='bx bx-minus-circle mr-2'></i>
                Despesa
              </button>
              <button
                type="button"
                onClick={() => setTransactionType('income')}
                className={`flex-1 py-3 px-4 rounded-xl border transition-all ${
                  transactionType === 'income'
                    ? 'border-green-500 bg-green-500/10 text-green-500'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <i className='bx bx-plus-circle mr-2'></i>
                Receita
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="account_id">Conta *</Label>
              <select
                id="account_id"
                {...register('account_id')}
                className="w-full px-3 py-2 rounded-md border border-input bg-background"
              >
                <option value="">Selecione uma conta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              {errors.account_id && (
                <p className="text-sm text-destructive mt-1">{errors.account_id.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="category_id">Categoria</Label>
              <select
                id="category_id"
                {...register('category_id')}
                className="w-full px-3 py-2 rounded-md border border-input bg-background"
              >
                <option value="">Sem categoria</option>
                <optgroup label="Receitas">
                  {filteredCategories.filter(c => c.type === 'income').map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Despesas">
                  {filteredCategories.filter(c => c.type === 'expense').map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              {...register('description')}
              placeholder="Ex: Salário, Supermercado..."
            />
            {errors.description && (
              <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="text"
                {...register('amount')}
                placeholder="0,00"
                onBlur={(e) => {
                  const value = e.target.value.replace(/[^\d,.-]/g, '').replace(',', '.');
                  const num = parseFloat(value);
                  if (!isNaN(num)) {
                    e.target.value = Math.abs(num).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                  }
                }}
              />
              {errors.amount && (
                <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="posted_at">Data *</Label>
              <Input
                id="posted_at"
                type="date"
                {...register('posted_at')}
              />
              {errors.posted_at && (
                <p className="text-sm text-destructive mt-1">{errors.posted_at.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <textarea
              id="notes"
              {...register('notes')}
              className="w-full px-3 py-2 rounded-md border border-input bg-background min-h-[60px]"
              placeholder="Notas adicionais..."
            />
          </div>

          {/* Installment Section */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="isInstallment"
                checked={isInstallment}
                onChange={(e) => setIsInstallment(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="isInstallment" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <i className='bx bx-credit-card'></i>
                Transação Parcelada
              </label>
            </div>

            {isInstallment && (
              <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-primary/30">
                <div>
                  <Label>Parcela Atual</Label>
                  <Input
                    type="number"
                    min="1"
                    value={installmentNumber}
                    onChange={(e) => setInstallmentNumber(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div>
                  <Label>Total de Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    value={installmentTotal}
                    onChange={(e) => setInstallmentTotal(e.target.value)}
                    placeholder="12"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Recurrence Section */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="isRecurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="isRecurring" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <i className='bx bx-repeat'></i>
                Transação Recorrente
              </label>
            </div>

            {isRecurring && (
              <div className="space-y-3 pl-6 border-l-2 border-primary/30">
                <div>
                  <Label>Frequência</Label>
                  <select
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background"
                  >
                    {RECURRENCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {recurrenceType === 'custom' && (
                  <div>
                    <Label>Regra Personalizada (RRULE)</Label>
                    <Input
                      value={customRecurrence}
                      onChange={(e) => setCustomRecurrence(e.target.value)}
                      placeholder="Ex: FREQ=MONTHLY;INTERVAL=2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Formato iCalendar RRULE
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : transaction ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
