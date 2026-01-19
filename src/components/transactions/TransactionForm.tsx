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
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useMembers } from '@/hooks/useMembers';

export interface Transaction {
  id?: string;
  description: string;
  amount: number | string;
  posted_at: string;
  account_id?: string;
  category_id?: string;
  notes?: string;
  recurrence_rule?: string;
  installment_number?: number;
  installment_total?: number;
  assigned_to?: string | null;
}

interface Account {
  id: string;
  name: string;
  type?: string;
  icon?: string;
  color?: string;
  last_four_digits?: string;
  is_expired?: boolean;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  transaction?: Transaction;
  accounts: Account[];
  creditCards?: Account[];
  categories: Array<{ id: string; name: string; type: string; source_type?: string | null }>;
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


export default function TransactionForm({
  open,
  onOpenChange,
  onSubmit,
  transaction,
  accounts,
  creditCards = [],
  categories,
}: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentNumber, setInstallmentNumber] = useState('1');
  const [installmentTotal, setInstallmentTotal] = useState('12');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const { members, loading: loadingMembers } = useMembers();

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
  
  // Combine accounts and credit cards into a single list
  // Filter out expired credit cards
  const allAccounts = [
    ...accounts.map(acc => ({ ...acc, isCreditCard: false })),
    ...creditCards
      .filter(card => !card.is_expired) // Filter out expired cards
      .map(card => ({ ...card, isCreditCard: true }))
  ];
  
  // Group categories by source_type
  const generalIncome = categories.filter(c => c.type === 'income' && (c.source_type === 'general' || !c.source_type));
  const generalExpense = categories.filter(c => c.type === 'expense' && (c.source_type === 'general' || !c.source_type));
  const creditCardCategories = categories.filter(c => c.source_type === 'credit_card');
  const investmentCategories = categories.filter(c => c.source_type === 'investment');
  const goalCategories = categories.filter(c => c.source_type === 'goal');
  const debtCategories = categories.filter(c => c.source_type === 'debt');

  // Initialize state from transaction when editing
  useEffect(() => {
    if (transaction) {
      const amount = typeof transaction.amount === 'number' ? transaction.amount : parseFloat(String(transaction.amount));
      setTransactionType(amount >= 0 ? 'income' : 'expense');
      setIsInstallment(!!(transaction.installment_number && transaction.installment_total));
      setInstallmentNumber(String(transaction.installment_number || 1));
      setInstallmentTotal(String(transaction.installment_total || 1));
      setAssignedTo(transaction.assigned_to || '');

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
      setIsInstallment(false);
      setInstallmentNumber('1');
      setInstallmentTotal('1');
      setAssignedTo(members.length > 0 ? members[0].id : '');
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
  }, [transaction, reset, open, members]);

  const [showFutureDateDialog, setShowFutureDateDialog] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<TransactionFormData | null>(null);

  const onFormSubmit = async (data: TransactionFormData) => {
    // Check if date is in the future
    const transactionDate = new Date(data.posted_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    transactionDate.setHours(0, 0, 0, 0);

    if (transactionDate > today) {
      // Show confirmation dialog
      setPendingSubmitData(data);
      setShowFutureDateDialog(true);
      return;
    }

    // Proceed with submission
    await submitTransaction(data);
  };

  const submitTransaction = async (data: TransactionFormData) => {
    try {
      setLoading(true);
      // Convert amount string to cents
      const amountInReais = parseFloat(data.amount.replace(/[^\d,.-]/g, '').replace(',', '.'));
      const amountCents = Math.round(Math.abs(amountInReais) * 100);

      await onSubmit({
        ...data,
        amount_cents: amountCents,
        type: transactionType,
        recurrence_rule: undefined,
        contribution_frequency: undefined,
        installment_number: isInstallment ? parseInt(installmentNumber) : undefined,
        installment_total: isInstallment ? parseInt(installmentTotal) : undefined,
        assigned_to: assignedTo || undefined,
      } as any);

      onOpenChange(false);
      reset();
      setPendingSubmitData(null);
    } catch (error) {
      console.error('Error submitting transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmFutureDate = async () => {
    if (pendingSubmitData) {
      await submitTransaction(pendingSubmitData);
    }
    setShowFutureDateDialog(false);
  };

  const handleCancelFutureDate = () => {
    setShowFutureDateDialog(false);
    setPendingSubmitData(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
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

          {/* Account/Credit Card Selection */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                {(() => {
                  const selectedAccount = allAccounts.find(acc => acc.id === selectedAccountId);
                  const isCreditCard = selectedAccount?.isCreditCard || selectedAccount?.type === 'credit';
                  return (
                    <Label htmlFor="account_id">{isCreditCard ? 'Forma de pagamento' : 'Conta'} *</Label>
                  );
                })()}
                <Select
                  onValueChange={(value) => {
                    const event = { target: { name: 'account_id', value } } as any;
                    register('account_id').onChange(event);
                  }}
                  value={watch('account_id')}
                >
                  <SelectTrigger id="account_id" className="w-full">
                    <SelectValue placeholder="Selecione uma conta ou cartão" />
                  </SelectTrigger>
                  <SelectContent>
                    {allAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.isCreditCard ? '💳' : account.icon || '🏦'} {account.name}
                        {account.isCreditCard && account.last_four_digits ? ` **** ${account.last_four_digits}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.account_id && (
                  <p className="text-sm text-destructive mt-1">{errors.account_id.message}</p>
                )}
              </div>

            <div>
              <Label htmlFor="category_id">Categoria</Label>
              <Select
                onValueChange={(value) => {
                  const actualValue = value === 'no-category' ? '' : value;
                  const event = { target: { name: 'category_id', value: actualValue } } as any;
                  register('category_id').onChange(event);
                }}
                value={watch('category_id') || 'no-category'}
              >
                <SelectTrigger id="category_id" className="w-full">
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-category">Sem categoria</SelectItem>
                  {generalIncome.length > 0 && (
                    <SelectItem value="group-income" disabled>
                      ────────────── Receitas ──────────────
                    </SelectItem>
                  )}
                  {generalIncome.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                  {generalExpense.length > 0 && (
                    <SelectItem value="group-expense" disabled>
                      ────────────── Despesas ──────────────
                    </SelectItem>
                  )}
                  {generalExpense.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                  {creditCardCategories.length > 0 && (
                    <SelectItem value="group-credit" disabled>
                      ────────────── 💳 Cartões de Crédito ──────────────
                    </SelectItem>
                  )}
                  {creditCardCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                  {investmentCategories.length > 0 && (
                    <SelectItem value="group-investment" disabled>
                      ────────────── 📊 Investimentos ──────────────
                    </SelectItem>
                  )}
                  {investmentCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                  {goalCategories.length > 0 && (
                    <SelectItem value="group-goal" disabled>
                      ────────────── 🎯 Objetivos ──────────────
                    </SelectItem>
                  )}
                  {goalCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                  {debtCategories.length > 0 && (
                    <SelectItem value="group-debt" disabled>
                      ────────────── 💳 Dívidas ──────────────
                    </SelectItem>
                  )}
                  {debtCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <DatePicker
                date={watch('posted_at') ? new Date(watch('posted_at')) : undefined}
                setDate={(date) => {
                  if (date) {
                    const formattedDate = format(date, 'yyyy-MM-dd');
                    // Update the form field value
                    const event = { target: { name: 'posted_at', value: formattedDate } } as any;
                    register('posted_at').onChange(event);
                  }
                }}
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

          {/* Responsible Person */}
          {members.length > 1 && (
            <div>
              <Label htmlFor="assigned_to">Responsável</Label>
              <Select
                value={assignedTo}
                onValueChange={setAssignedTo}
                disabled={loadingMembers}
              >
                <SelectTrigger id="assigned_to" className="w-full">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.fullName || 'Avatar'}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                            {(member.fullName || member.email)[0].toUpperCase()}
                          </div>
                        )}
                        <span>{member.fullName || member.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Quem é responsável por esta transação?
              </p>
            </div>
          )}

          {/* Installment Section */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="isInstallment"
                checked={isInstallment}
                onCheckedChange={(checked) => setIsInstallment(checked === true)}
                className="h-5 w-5"
              />
              <label htmlFor="isInstallment" className="flex items-center gap-2 text-sm font-medium cursor-pointer flex-1">
                <i className='bx bx-credit-card text-lg'></i>
                <span>Compra Parcelada</span>
              </label>
            </div>

            {isInstallment && (
              <div className="space-y-4 pl-4 sm:pl-6 border-l-2 border-primary/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(() => {
                    const selectedAccount = allAccounts.find(acc => acc.id === selectedAccountId);
                    const isCreditCard = selectedAccount?.isCreditCard || false;
                    
                    return (
                      <>
                        {!isCreditCard && (
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
                        )}
                        <div className={isCreditCard ? 'col-span-1' : ''}>
                          <Label>Total de Parcelas</Label>
                          <div className="flex flex-wrap gap-2">
                            {[2, 3, 6, 10, 12].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setInstallmentTotal(String(num))}
                                className={`px-3 py-1.5 rounded border text-sm transition-all shrink-0 ${
                                  installmentTotal === String(num)
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:bg-muted/50'
                                }`}
                              >
                                {num}x
                              </button>
                            ))}
                            <Input
                              type="number"
                              min="2"
                              max="48"
                              value={installmentTotal}
                              onChange={(e) => setInstallmentTotal(e.target.value)}
                              placeholder="Outro"
                              className="w-20 shrink-0"
                            />
                          </div>
                        </div>
                        {isCreditCard && parseInt(installmentTotal) > 1 && (
                          <div className="col-span-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
                            <p className="flex items-center gap-2 text-blue-500">
                              <i className='bx bx-info-circle'></i>
                              <strong>Parcelamento automático</strong>
                            </p>
                            <p className="text-muted-foreground mt-1">
                              Serão criadas {installmentTotal} parcelas automaticamente nas faturas dos próximos meses.
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
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

      {/* Future Date Confirmation Dialog */}
      <Dialog open={showFutureDateDialog} onOpenChange={setShowFutureDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transação Futura</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta transação será criada com data futura e aparecerá apenas como projeção (orçamento) até a data chegar. Deseja continuar?
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelFutureDate}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmFutureDate}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
