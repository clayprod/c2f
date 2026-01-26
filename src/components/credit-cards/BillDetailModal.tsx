'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

interface Transaction {
  id: string;
  description: string;
  amount_cents: number;
  posted_at: string;
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null;
  installment_number: number | null;
  installment_total: number | null;
  notes: string | null;
}

interface CategoryBreakdown {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  count: number;
}

interface Bill {
  id: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
  total_cents: number;
  minimum_payment_cents: number;
  paid_cents: number;
  previous_balance_cents: number;
  interest_cents: number;
  interest_rate_applied: number;
  status: 'open' | 'closed' | 'paid' | 'partial' | 'overdue';
  payment_date: string | null;
  card: {
    id: string;
    name: string;
    last_four_digits: string | null;
    card_brand: string | null;
    color: string;
    icon: string;
    interest_rate_monthly: number;
  };
  transactions: Transaction[];
  category_breakdown: CategoryBreakdown[];
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance_cents: number;
}

interface BillDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  billId: string;
  onPaymentSuccess: () => void;
}

export default function BillDetailModal({
  open,
  onOpenChange,
  cardId,
  billId,
  onPaymentSuccess,
}: BillDetailModalProps) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    from_account_id: '',
    payment_date: new Date().toISOString().split('T')[0],
  });
  const [showInterestDialog, setShowInterestDialog] = useState(false);
  const [interestData, setInterestData] = useState({
    interest_cents: '',
    interest_rate: '',
  });
  const [interestLoading, setInterestLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && cardId && billId) {
      fetchBill();
      fetchAccounts();
    }
  }, [open, cardId, billId]);

  const fetchBill = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/credit-cards/${cardId}/bills/${billId}`);
      
      if (!res.ok) {
        const error = await res.json();
        // Se for 404, a fatura realmente não existe
        if (res.status === 404) {
          setBill(null);
          return;
        }
        throw new Error(error.error || 'Não foi possível carregar a fatura');
      }
      
      const data = await res.json();
      setBill(data.data);

      // Set default payment amount to remaining balance
      if (data.data) {
        const remaining = data.data.total_cents - data.data.paid_cents;
        setPaymentData(prev => ({
          ...prev,
          amount: (remaining / 100).toFixed(2),
        }));
      }
    } catch (error: any) {
      console.error('Error fetching bill:', error);
      toast({
        title: 'Falha ao carregar fatura',
        description: error.message || 'Não foi possível carregar os detalhes da fatura. Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      // Filter only non-credit card accounts for payment source
      setAccounts((data.data || []).filter((a: Account) => a.type !== 'credit_card'));
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handlePayment = async () => {
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Por favor, informe um valor válido para o pagamento',
        variant: 'destructive',
      });
      return;
    }

    try {
      setPaymentLoading(true);

      const res = await fetch(`/api/credit-cards/${cardId}/bills/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay',
          amount_cents: Math.round(parseFloat(paymentData.amount) * 100),
          payment_date: paymentData.payment_date,
          from_account_id: paymentData.from_account_id || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao registrar pagamento');
      }

      toast({
        title: 'Sucesso',
        description: 'Pagamento registrado',
      });

      setShowPayDialog(false);
      fetchBill();
      onPaymentSuccess();
    } catch (error: any) {
      toast({
        title: 'Falha ao registrar pagamento',
        description: error.message || 'Não foi possível registrar o pagamento. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const getStatusBadge = (status: Bill['status']) => {
    const styles = {
      open: 'bg-blue-500/20 text-blue-500',
      closed: 'bg-yellow-500/20 text-yellow-500',
      paid: 'bg-green-500/20 text-positive',
      partial: 'bg-orange-500/20 text-orange-500',
      overdue: 'bg-red-500/20 text-negative',
    };
    const labels = {
      open: 'Aberta',
      closed: 'Fechada',
      paid: 'Paga',
      partial: 'Parcialmente Paga',
      overdue: 'Vencida',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Carregando fatura</DialogTitle>
            <DialogDescription>
              Aguarde enquanto carregamos os detalhes da fatura...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <i className='bx bx-loader-alt bx-spin text-4xl text-primary'></i>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!bill) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fatura não encontrada</DialogTitle>
            <DialogDescription>
              A fatura solicitada não foi encontrada ou não existe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const remainingAmount = bill.total_cents - bill.paid_cents;
  const paidPercentage = bill.total_cents > 0
    ? Math.round((bill.paid_cents / bill.total_cents) * 100)
    : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-white"
                style={{ backgroundColor: bill.card.color }}
              >
                {bill.card.icon}
              </div>
              <div>
                <DialogTitle>Fatura de {formatMonth(bill.reference_month)}</DialogTitle>
                <DialogDescription>
                  {bill.card.name} {bill.card.last_four_digits && `**** ${bill.card.last_four_digits}`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Summary */}
            <div className="glass-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                {getStatusBadge(bill.status)}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Fechamento</p>
                  <p className="font-medium">{formatDate(bill.closing_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="font-medium">{formatDate(bill.due_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-bold text-lg">{formatCurrency(bill.total_cents)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pagamento Minimo</p>
                  <p className="font-medium">{formatCurrency(bill.minimum_payment_cents)}</p>
                </div>
              </div>

              {/* Payment Progress */}
              {bill.total_cents > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Pago</span>
                    <span>{formatCurrency(bill.paid_cents)} ({paidPercentage}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${paidPercentage}%` }}
                    />
                  </div>
                  {remainingAmount > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Falta: {formatCurrency(remainingAmount)}
                    </p>
                  )}
                </div>
              )}

              {/* Interest & Previous Balance Info */}
              {(bill.previous_balance_cents > 0 || bill.interest_cents > 0) && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 space-y-2">
                  <h4 className="text-sm font-medium text-yellow-600 flex items-center gap-2">
                    <i className='bx bx-info-circle'></i>
                    Encargos da Fatura
                  </h4>
                  {bill.previous_balance_cents > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Saldo anterior</span>
                      <span className="font-medium">{formatCurrency(bill.previous_balance_cents)}</span>
                    </div>
                  )}
                  {bill.interest_cents > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Juros ({bill.interest_rate_applied || 0}% a.m.)
                      </span>
                      <span className="font-medium text-negative">{formatCurrency(bill.interest_cents)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {bill.status !== 'paid' && remainingAmount > 0 && (
                  <Button onClick={() => setShowPayDialog(true)} className="flex-1">
                    <i className='bx bx-money mr-2'></i>
                    Registrar Pagamento
                  </Button>
                )}
                {(bill.status === 'open' || bill.status === 'partial') && remainingAmount > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setInterestData({
                        interest_cents: ((bill.interest_cents || 0) / 100).toFixed(2),
                        interest_rate: String(bill.card?.interest_rate_monthly || bill.interest_rate_applied || 0),
                      });
                      setShowInterestDialog(true);
                    }}
                    className="flex-shrink-0"
                  >
                    <i className='bx bx-edit mr-2'></i>
                    Juros
                  </Button>
                )}
              </div>
            </div>

            {/* Category Breakdown */}
            {bill.category_breakdown && bill.category_breakdown.length > 0 && (
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <i className='bx bx-pie-chart-alt'></i>
                  Gastos por Categoria
                </h3>
                <div className="space-y-2">
                  {bill.category_breakdown
                    .sort((a, b) => b.total - a.total)
                    .map((cat) => {
                      const percentage = bill.total_cents > 0
                        ? Math.round((cat.total / bill.total_cents) * 100)
                        : 0;
                      return (
                        <div key={cat.category_id} className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: cat.color + '20' }}
                          >
                            {cat.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between text-sm">
                              <span>{cat.name}</span>
                              <span className="font-medium">{formatCurrency(cat.total)}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: cat.color,
                                }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground w-12 text-right">
                            {percentage}%
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Transactions */}
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <i className='bx bx-list-ul'></i>
                Transações ({bill.transactions.length})
              </h3>
              {bill.transactions.length === 0 ? (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
                  <i className='bx bx-info-circle text-blue-500 text-2xl mb-2'></i>
                  <p className="text-blue-500 font-medium">Nenhuma transação nesta fatura</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    As transações aparecerão aqui quando forem adicionadas a esta fatura
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {bill.transactions
                    .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime())
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{
                            backgroundColor: (tx.category?.color || '#6b7280') + '20'
                          }}
                        >
                          {tx.category?.icon || '📝'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{tx.description}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatDate(tx.posted_at)}</span>
                            {tx.category && <span>{tx.category.name}</span>}
                            {tx.installment_number && tx.installment_total && (
                              <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                                {tx.installment_number}/{tx.installment_total}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className={`font-semibold ${tx.amount_cents >= 0 ? 'text-negative' : 'text-positive'}`}>
                          {formatCurrency(Math.abs(tx.amount_cents))}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interest Edit Dialog */}
      <Dialog open={showInterestDialog} onOpenChange={setShowInterestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Juros</DialogTitle>
            <DialogDescription>
              Defina os juros para esta fatura. Os valores serão acumulados na próxima fatura se a atual não for totalmente paga.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="interest_rate">Taxa de Juros Mensal (%)</Label>
              <Input
                id="interest_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={interestData.interest_rate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value) || 0;
                  const unpaid = (bill?.total_cents || 0) - (bill?.paid_cents || 0);
                  const calculatedInterest = Math.round(unpaid * (rate / 100));
                  setInterestData({
                    interest_rate: e.target.value,
                    interest_cents: (calculatedInterest / 100).toFixed(2),
                  });
                }}
                placeholder="14.99"
              />
            </div>

            <div>
              <Label htmlFor="interest_amount">Valor dos Juros (R$)</Label>
              <Input
                id="interest_amount"
                type="number"
                step="0.01"
                min="0"
                value={interestData.interest_cents}
                onChange={(e) => setInterestData({ ...interestData, interest_cents: e.target.value })}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Calculado sobre o saldo não pago de {formatCurrency(remainingAmount)}
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-sm text-blue-500">
                <i className='bx bx-info-circle mr-2'></i>
                Os juros serão adicionados ao saldo da próxima fatura quando esta for fechada sem pagamento total.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInterestDialog(false)} disabled={interestLoading}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                try {
                  setInterestLoading(true);
                  const res = await fetch(`/api/credit-cards/${cardId}/bills/${billId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      interest_cents: Math.round(parseFloat(interestData.interest_cents) * 100),
                      interest_rate_applied: parseFloat(interestData.interest_rate),
                    }),
                  });

                  if (!res.ok) throw new Error('Erro ao salvar juros');

                  toast({ title: 'Sucesso', description: 'Juros atualizados' });
                  setShowInterestDialog(false);
                  fetchBill();
                } catch (error: any) {
                  toast({ title: 'Falha ao atualizar juros', description: error.message || 'Não foi possível atualizar os juros da fatura. Tente novamente.', variant: 'destructive' });
                } finally {
                  setInterestLoading(false);
                }
              }}
              disabled={interestLoading}
            >
              {interestLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Restante: {formatCurrency(remainingAmount)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="payment_amount">Valor do Pagamento (R$)</Label>
              <Input
                id="payment_amount"
                type="number"
                step="0.01"
                min="0"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                placeholder="0,00"
              />
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentData({
                    ...paymentData,
                    amount: (bill.minimum_payment_cents / 100).toFixed(2)
                  })}
                >
                  Minimo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentData({
                    ...paymentData,
                    amount: (remainingAmount / 100).toFixed(2)
                  })}
                >
                  Total
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="payment_date">Data do Pagamento</Label>
              <DatePicker
                date={paymentData.payment_date ? new Date(paymentData.payment_date) : undefined}
                setDate={(date) => {
                  if (date) {
                    const formattedDate = format(date, 'yyyy-MM-dd');
                    setPaymentData({ ...paymentData, payment_date: formattedDate });
                  }
                }}
                placeholder="Selecione a data do pagamento"
              />
            </div>

            <div>
              <Label htmlFor="from_account">Conta de Origem (opcional)</Label>
              <select
                id="from_account"
                value={paymentData.from_account_id}
                onChange={(e) => setPaymentData({ ...paymentData, from_account_id: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-input bg-background"
              >
                <option value="">Não vincular a conta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({formatCurrency(account.balance_cents)})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Se selecionado, uma transação será criada na conta
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)} disabled={paymentLoading}>
              Cancelar
            </Button>
            <Button onClick={handlePayment} disabled={paymentLoading}>
              {paymentLoading ? 'Processando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
