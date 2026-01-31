'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { waitForJobCompletion } from '@/lib/jobs/client';
import CreditCardForm from '@/components/credit-cards/CreditCardForm';
import BillDetailModal from '@/components/credit-cards/BillDetailModal';
import TransactionForm from '@/components/transactions/TransactionForm';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, PieChart, Pie, Cell } from 'recharts';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { formatMonthYear, formatCurrency } from '@/lib/utils';
import { InfoIcon } from '@/components/ui/InfoIcon';
import { useAccountContext } from '@/hooks/useAccountContext';
import { useRealtimeCashflowUpdates } from '@/hooks/useRealtimeCashflowUpdates';

interface CreditCard {
  id: string;
  name: string;
  institution: string | null;
  last_four_digits: string | null;
  card_brand: string | null;
  credit_limit_cents: number;
  available_limit_cents: number;
  used_limit_cents: number;
  usage_percentage: number;
  closing_day: number;
  due_day: number;
  expiration_date: string | null;
  interest_rate_monthly: number;
  interest_rate_annual: number;
  color: string;
  icon: string;
  is_default: boolean;
  current_bill: Bill | null;
  is_expired?: boolean;
  category_id?: string | null;
  assigned_to_profile?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

interface Bill {
  id: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
  total_cents: number;
  minimum_payment_cents: number;
  paid_cents: number;
  status: 'open' | 'closed' | 'paid' | 'partial' | 'overdue';
  transactions?: any[];
}


const cardBrands = [
  { value: 'visa', label: 'Visa', icon: '💳' },
  { value: 'mastercard', label: 'Mastercard', icon: '💳' },
  { value: 'amex', label: 'American Express', icon: '💳' },
  { value: 'elo', label: 'Elo', icon: '💳' },
  { value: 'hipercard', label: 'Hipercard', icon: '💳' },
  { value: 'diners', label: 'Diners', icon: '💳' },
  { value: 'other', label: 'Outro', icon: '💳' },
];

const cardColors = [
  '#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560',
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

export default function CreditCardsPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [billDetailOpen, setBillDetailOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);
  const [selectedBill, setSelectedBill] = useState<{ cardId: string; billId: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentMonthBills, setCurrentMonthBills] = useState<Bill[]>([]);
  const [currentMonthSummary, setCurrentMonthSummary] = useState({
    totalToPay: 0,
    totalPaid: 0,
    remaining: 0,
  });
  const [cardBillsMap, setCardBillsMap] = useState<Map<string, Bill[]>>(new Map());
  const [cardTransactionsMap, setCardTransactionsMap] = useState<Map<string, any[]>>(new Map());
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [chartData, setChartData] = useState<any[]>([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(0);
  const [categorySpending, setCategorySpending] = useState<any[]>([]);
  const [payBillDialogOpen, setPayBillDialogOpen] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<{
    cardId: string;
    billId: string;
    cardName: string;
    categoryId: string | null;
    remainingAmount: number;
  } | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const { toast } = useToast();
  const { context: accountContext, activeAccountId } = useAccountContext();
  const ownerId = activeAccountId || accountContext?.currentUserId || null;

  useEffect(() => {
    fetchCards();
  }, []);

  useRealtimeCashflowUpdates({
    ownerId,
    onRefresh: () => {
      fetchCards();
    },
    tables: ['accounts', 'credit_card_bills', 'transactions'],
    events: ['INSERT', 'UPDATE', 'DELETE'],
  });

  useEffect(() => {
    if (cards.length > 0) {
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonth(currentMonthStr);
      fetchCurrentMonthBills(cards, currentMonthStr);
      fetchChartData(cards);
    }
  }, [cards]);

  const fetchCards = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/credit-cards');
      const data = await res.json();
      setCards(data.data || []);
    } catch (error) {
      console.error('Error fetching credit cards:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os cartões',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentMonthBills = async (cardsList: CreditCard[], monthStr?: string) => {
    try {
      const now = new Date();
      const monthToUse = monthStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const [year, month] = monthToUse.split('-');
      const currentMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
      const currentMonthStr = currentMonth.toISOString().split('T')[0].substring(0, 7);

      const allBills: Bill[] = [];
      const billsMap = new Map<string, Bill[]>();
      const transactionsMap = new Map<string, any[]>();

      for (const card of cardsList) {
        try {
          const res = await fetch(`/api/credit-cards/${card.id}/bills?limit=12`);
          const data = await res.json();
          const cardBills = (data.data || []) as Bill[];

          // Armazenar todas as faturas do cartão
          billsMap.set(card.id, cardBills);

          // Filtrar faturas do mês corrente
          const currentBills = cardBills.filter(bill => {
            const billMonth = bill.reference_month.substring(0, 7);
            return billMonth === currentMonthStr;
          });

          allBills.push(...currentBills);

          if (currentBills.length > 0) {
            const billTransactions = currentBills.flatMap(bill => bill.transactions || []);
            transactionsMap.set(card.id, billTransactions);
          } else {
            transactionsMap.set(card.id, []);
          }
        } catch (error) {
          console.error(`Error fetching bills for card ${card.id}:`, error);
        }
      }

      setCurrentMonthBills(allBills);
      setCardBillsMap(billsMap);
      setCardTransactionsMap(transactionsMap);

      // Calcular consolidado
      const totalToPay = allBills.reduce((sum, bill) => sum + bill.total_cents, 0);
      const totalPaid = allBills.reduce((sum, bill) => sum + bill.paid_cents, 0);
      const remaining = totalToPay - totalPaid;

      setCurrentMonthSummary({
        totalToPay,
        totalPaid,
        remaining,
      });
    } catch (error) {
      console.error('Error fetching current month bills:', error);
    }
  };

  const fetchChartData = async (cardsList: CreditCard[]) => {
    try {
      const now = new Date();
      const months: any[] = [];
      
      // Últimos 6 meses
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.push({ month: monthStr, type: 'historical' });
      }
      
      // Próximos 3 meses (projeção)
      for (let i = 1; i <= 3; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.push({ month: monthStr, type: 'projection' });
      }

      const chartDataPoints: any[] = [];
      let lastHistoricalTotal = 0;
      let lastHistoricalPaid = 0;

      for (const monthInfo of months) {
        const [year, month] = monthInfo.month.split('-');
        const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const monthDateStr = monthDate.toISOString().split('T')[0].substring(0, 7);

        let totalToPay = 0;
        let totalPaid = 0;

        if (monthInfo.type === 'historical') {
          // Buscar faturas históricas
          for (const card of cardsList) {
            try {
              const res = await fetch(`/api/credit-cards/${card.id}/bills?limit=12`);
              const data = await res.json();
              const cardBills = (data.data || []) as Bill[];
              
              const monthBills = cardBills.filter(bill => {
                const billMonth = bill.reference_month.substring(0, 7);
                return billMonth === monthDateStr;
              });

              totalToPay += monthBills.reduce((sum, bill) => sum + bill.total_cents, 0);
              totalPaid += monthBills.reduce((sum, bill) => sum + bill.paid_cents, 0);
            } catch (error) {
              console.error(`Error fetching bills for chart: ${card.id}`, error);
            }
          }
          lastHistoricalTotal = totalToPay / 100;
          lastHistoricalPaid = totalPaid / 100;
        } else {
          // Buscar faturas futuras para projeção
          for (const card of cardsList) {
            try {
              // Buscar todas as faturas do cartão
              const res = await fetch(`/api/credit-cards/${card.id}/bills?limit=12`);
              const data = await res.json();
              const cardBills = (data.data || []) as Bill[];
              
              // Filtrar faturas futuras (reference_month >= mês atual)
              const futureBills = cardBills.filter(bill => {
                const billMonth = bill.reference_month.substring(0, 7);
                return billMonth === monthDateStr;
              });

              // Somar total_cents e paid_cents das faturas futuras
              totalToPay += futureBills.reduce((sum, bill) => sum + bill.total_cents, 0);
              totalPaid += futureBills.reduce((sum, bill) => sum + bill.paid_cents, 0);
            } catch (error) {
              console.error(`Error fetching future bills for projection: ${card.id}`, error);
            }
          }
        }

        const monthInfoResult = formatMonthYear(monthDate, { returnCurrentMonthInfo: true });
        const monthLabel = typeof monthInfoResult === 'string' ? monthInfoResult : monthInfoResult.formatted;
        const isCurrentMonth = typeof monthInfoResult === 'object' ? monthInfoResult.isCurrentMonth : false;
        const isProjected = monthInfo.type === 'projection';
        
        // Simplificar estrutura: histórico usa total/pago, projeção usa totalProj/pagoProj
        // Criar continuidade visual conectando último histórico com primeira projeção
        const isFirstProjected = isProjected && chartDataPoints.length > 0 && !chartDataPoints[chartDataPoints.length - 1].isProjected;
        const isLastHistorical = !isProjected && chartDataPoints.length > 0 && chartDataPoints[chartDataPoints.length - 1].isProjected === false;
        
        chartDataPoints.push({
          month: monthLabel,
          // Histórico: usar total/pago. Projeção: null para não mostrar na linha histórica
          total: !isProjected ? totalToPay / 100 : (isFirstProjected ? lastHistoricalTotal : null),
          totalProj: isProjected ? totalToPay / 100 : (isLastHistorical ? lastHistoricalTotal : null),
          // Histórico: usar pago. Projeção: null para não mostrar na linha histórica
          pago: !isProjected ? totalPaid / 100 : (isFirstProjected ? lastHistoricalPaid : null),
          pagoProj: isProjected ? totalPaid / 100 : (isLastHistorical ? lastHistoricalPaid : null),
          isProjected,
          isCurrentMonth,
        });
      }

      // Reorganizar dados para centralizar mês corrente (mesma lógica do dashboard)
      const currentMonthIdx = chartDataPoints.findIndex(d => d.isCurrentMonth);
      
      if (currentMonthIdx >= 0) {
        // Dividir em histórico, mês corrente e projeção
        const historicalData = chartDataPoints.slice(0, currentMonthIdx);
        const currentMonthData = [chartDataPoints[currentMonthIdx]];
        const projectedData = chartDataPoints.slice(currentMonthIdx + 1);
        
        // Usar mesma lógica do dashboard: periodMonths = 12, então halfPeriod = 6
        const periodMonths = 12;
        const halfPeriod = Math.floor(periodMonths / 2);
        const monthsBefore = Math.min(halfPeriod, historicalData.length);
        const monthsAfter = Math.min(halfPeriod, projectedData.length);
        
        // Pegar últimos N meses históricos e primeiros N meses projetados
        const selectedHistorical = historicalData.slice(-monthsBefore);
        const selectedProjected = projectedData.slice(0, monthsAfter);
        
        // Combinar: histórico + mês corrente + projeção
        const reorganizedData = [
          ...selectedHistorical,
          ...currentMonthData,
          ...selectedProjected,
        ];
        
        // Recalcular isProjected baseado na nova organização
        const newCurrentMonthIndex = selectedHistorical.length;
        const finalData = reorganizedData.map((item, index) => ({
          ...item,
          isProjected: index > newCurrentMonthIndex,
        }));
        
        setChartData(finalData);
        setCurrentMonthIndex(newCurrentMonthIndex);
      } else {
        setChartData(chartDataPoints);
        setCurrentMonthIndex(0);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  const handleDelete = async () => {
    if (!cardToDelete) return;

    try {
      const res = await fetch(`/api/credit-cards/${cardToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao excluir cartão');
      }

      toast({
        title: 'Sucesso',
        description: 'Cartão excluído',
      });

      fetchCards();
      setDeleteDialogOpen(false);
      setCardToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openEditForm = (card: CreditCard) => {
    setEditingCard(card);
    setFormOpen(true);
  };

  const openNewForm = () => {
    setEditingCard(null);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    fetchCards();
    setFormOpen(false);
    setEditingCard(null);
  };

  const handleBillDetailClose = () => {
    setBillDetailOpen(false);
    setSelectedBill(null);
    if (cards.length > 0 && selectedMonth) {
      fetchCurrentMonthBills(cards, selectedMonth);
      fetchChartData(cards);
    }
  };

  const fetchCategorySpending = async (monthStr: string, cardId?: string) => {
    try {
      let allTransactions: any[] = [];

      if (cardId) {
        const cardBills = cardBillsMap.get(cardId) || [];
        const monthBills = cardBills.filter((bill) => bill.reference_month.substring(0, 7) === monthStr);
        allTransactions = monthBills.flatMap((bill) => bill.transactions || []);
      } else {
        cardBillsMap.forEach((bills) => {
          const monthBills = bills.filter((bill) => bill.reference_month.substring(0, 7) === monthStr);
          allTransactions.push(...monthBills.flatMap((bill) => bill.transactions || []));
        });
      }

      // Group by category
      const categoryMap = new Map<string, { name: string; value: number; color: string }>();

      allTransactions.forEach((tx: any) => {
        if (tx.category?.id) {
          const categoryId = tx.category.id;
          const categoryName = tx.category.name || 'Sem categoria';
          const amount = Math.abs(tx.amount_cents || 0);

          if (categoryMap.has(categoryId)) {
            const existing = categoryMap.get(categoryId)!;
            existing.value += amount;
            categoryMap.set(categoryId, existing);
          } else {
            categoryMap.set(categoryId, {
              name: categoryName,
              value: amount,
              color: tx.category.color || '#6b7280',
            });
          }
        }
      });

      setCategorySpending(Array.from(categoryMap.values()));
    } catch (error) {
      console.error('Error fetching category spending:', error);
      setCategorySpending([]);
    }
  };

  useEffect(() => {
    if (selectedMonth && cards.length > 0) {
      fetchCategorySpending(selectedMonth, selectedCardId || undefined);
    }
  }, [selectedMonth, selectedCardId, cards, cardBillsMap]);

  const openBillDetail = (cardId: string, billId: string) => {
    setSelectedBill({ cardId, billId });
    setBillDetailOpen(true);
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      // Filter only non-credit card accounts for payment source
      setAccounts((data.data || []).filter((a: any) => a.type !== 'credit_card'));
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handlePayBill = async (cardId: string, bill: Bill) => {
    try {
      // Buscar dados completos do cartão incluindo category_id
      const cardRes = await fetch(`/api/credit-cards/${cardId}`);
      const cardData = await cardRes.json();
      const card = cardData.data;
      
      if (!card) {
        toast({
          title: 'Erro',
          description: 'Cartão não encontrado',
          variant: 'destructive',
        });
        return;
      }

      const remainingAmount = bill.total_cents - bill.paid_cents;
      
      if (remainingAmount <= 0) {
        toast({
          title: 'Aviso',
          description: 'Esta fatura já está totalmente paga',
        });
        return;
      }

      // Buscar contas e categorias se ainda não foram buscadas
      await fetchAccounts();
      await fetchCategories();

      // Verificar se há categoria do cartão
      if (!card.category_id) {
        toast({
          title: 'Aviso',
          description: 'Este cartão não possui categoria associada. Por favor, edite o cartão primeiro.',
          variant: 'destructive',
        });
        return;
      }

      setSelectedBillForPayment({
        cardId,
        billId: bill.id,
        cardName: card.name,
        categoryId: card.category_id,
        remainingAmount,
      });
      setPayBillDialogOpen(true);
    } catch (error: any) {
      console.error('Error preparing payment:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível preparar o pagamento',
        variant: 'destructive',
      });
    }
  };

  const handleTransactionSubmit = async (data: any) => {
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: data.account_id,
          category_id: data.category_id,
          posted_at: data.posted_at,
          description: data.description,
          amount_cents: data.amount_cents,
          type: 'expense',
          currency: 'BRL',
          notes: data.notes || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao criar transação');
      }

      const responseData = await res.json();
      if (responseData.job_id) {
        await waitForJobCompletion(responseData.job_id);
      }

      toast({
        title: 'Sucesso',
        description: 'Pagamento registrado com sucesso',
      });

      setPayBillDialogOpen(false);
      setSelectedBillForPayment(null);
      
      // Atualizar lista de cartões
      await fetchCards();
      if (cards.length > 0 && selectedMonth) {
        await fetchCurrentMonthBills(cards, selectedMonth);
        await fetchChartData(cards);
      }
    } catch (error: any) {
      console.error('Error submitting transaction:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível registrar o pagamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const filteredCards = cards.filter(card =>
    card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.institution?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
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
      partial: 'Parcial',
      overdue: 'Vencida',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getUsageBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const totalLimit = cards.reduce((sum, card) => sum + card.credit_limit_cents, 0);
  const totalUsed = cards.reduce((sum, card) => sum + card.used_limit_cents, 0);
  const totalAvailable = cards.reduce((sum, card) => sum + card.available_limit_cents, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Cartões de Crédito</h1>
            <p className="text-muted-foreground">Gerencie seus cartões e faturas</p>
          </div>
          <InfoIcon
            content={
              <div className="space-y-2">
                <p className="font-semibold">Sobre esta seção:</p>
                <ul className="space-y-1.5 text-xs list-disc list-inside">
                  <li>Adicione e gerencie seus cartões de crédito com limites, datas de fechamento e vencimento.</li>
                  <li>Visualize o status das faturas e acompanhe seus gastos por cartão.</li>
                  <li>Monitore o uso do limite e veja a distribuição de gastos por categoria.</li>
                  <li>Integre com instituições financeiras para sincronizar transações automaticamente.</li>
                </ul>
              </div>
            }
          />
        </div>
        <Button onClick={openNewForm} className="btn-primary">
          <i className='bx bx-plus mr-2'></i>
          Novo Cartão
        </Button>
      </div>

      {/* Consolidated Bills */}
      {cards.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Faturas Consolidadas Card */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium flex items-center gap-2">
                <i className='bx bx-receipt text-xl'></i>
                Faturas Consolidadas
              </h2>
              <InfoIcon
                content={
                  <div className="space-y-2">
                    <p className="font-semibold">Sobre esta seção:</p>
                    <ul className="space-y-1.5 text-xs list-disc list-inside">
                      <li><strong>Total a Pagar:</strong> Soma de todas as faturas dos cartões no mês selecionado.</li>
                      <li><strong>Total Pago:</strong> Valor já pago das faturas do mês selecionado.</li>
                      <li><strong>Restante:</strong> Valor que ainda precisa ser pago.</li>
                      <li><strong>Barra de progresso:</strong> Mostra o percentual já pago da fatura.</li>
                      <li><strong>Gastos por Categoria:</strong> Distribuição dos gastos do mês selecionado por categoria.</li>
                      <li>Use o seletor de mês e cartão para visualizar diferentes períodos.</li>
                    </ul>
                  </div>
                }
              />
            </div>
            
            {/* Filtros compactos lado a lado */}
            <div className="mb-4 flex gap-2">
              <div className="flex-1">
                <MonthYearPicker
                  value={selectedMonth}
                  onChange={(value) => {
                    setSelectedMonth(value);
                    fetchCurrentMonthBills(cards, value);
                  }}
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <select
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Todos os cartões</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name} {card.last_four_digits ? `**** ${card.last_four_digits}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {currentMonthBills.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total a Pagar</p>
                    <p className="text-2xl font-bold">{formatCurrency(currentMonthSummary.totalToPay)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Pago</p>
                    <p className="text-2xl font-bold text-positive">{formatCurrency(currentMonthSummary.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Restante</p>
                    <p className={`text-2xl font-bold ${currentMonthSummary.remaining > 0 ? 'text-orange-500' : 'text-positive'}`}>
                      {formatCurrency(currentMonthSummary.remaining)}
                    </p>
                  </div>
                </div>
                {currentMonthSummary.totalToPay > 0 && (
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progresso de Pagamento</span>
                      <span className="font-medium">
                        {Math.round((currentMonthSummary.totalPaid / currentMonthSummary.totalToPay) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${Math.min(100, (currentMonthSummary.totalPaid / currentMonthSummary.totalToPay) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <i className='bx bx-info-circle text-3xl mb-2'></i>
                <p>Nenhuma fatura encontrada para o mês selecionado</p>
              </div>
            )}

            {/* Gastos por Categoria */}
            <div className="border-t border-border pt-6">
              <h3 className="font-medium flex items-center gap-2 mb-4 text-sm">
                <i className='bx bx-pie-chart text-lg'></i>
                Gastos por Categoria
              </h3>
              {categorySpending.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categorySpending}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categorySpending.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || cardColors[index % cardColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  <div className="text-center">
                    <i className='bx bx-info-circle text-3xl mb-2'></i>
                    <p className="text-sm">Nenhum gasto por categoria encontrado</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Histórico e Projeção Card */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium flex items-center gap-2">
                <i className='bx bx-line-chart text-xl'></i>
                Histórico e Projeção
              </h2>
              <InfoIcon
                content={
                  <div className="space-y-2">
                    <p className="font-semibold">Sobre esta seção:</p>
                    <ul className="space-y-1.5 text-xs list-disc list-inside">
                      <li><strong>Gráfico de Linha:</strong> Mostra histórico dos últimos meses e projeção dos próximos meses.</li>
                      <li>As projeções são baseadas em transações parceladas futuras.</li>
                      <li>A linha tracejada representa valores projetados.</li>
                    </ul>
                  </div>
                }
              />
            </div>

            {/* Line Chart - Histórico e Projeção */}
            <div>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--muted-foreground))"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        style={{ fontSize: '12px' }}
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(value: number) => {
                          if (value === null || value === undefined || isNaN(value)) {
                            return 'N/A';
                          }
                          return formatCurrency(value * 100);
                        }}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      
                      {/* Barra azul transparente para mês corrente */}
                      {currentMonthIndex >= 0 && currentMonthIndex < chartData.length && (
                        <ReferenceArea
                          x1={chartData[currentMonthIndex]?.month}
                          x2={chartData[currentMonthIndex]?.month}
                          y1="dataMin"
                          y2="dataMax"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.1}
                          stroke="none"
                          ifOverflow="extendDomain"
                        />
                      )}
                      
                      {/* Linha histórica de Total a Pagar */}
                      <Line 
                        type="monotone" 
                        dataKey="total" 
                        name="Total a Pagar"
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={(props: any) => {
                          const { payload } = props;
                          if (!payload || payload.total === null || payload.total === undefined) {
                            // Return an empty SVG element instead of null
                            return <g />;
                          }
                          return (
                            <circle
                              cx={props.cx}
                              cy={props.cy}
                              r={3}
                              fill="hsl(var(--primary))"
                            />
                          );
                        }}
                        connectNulls={true}
                      />
                      {/* Linha projetada de Total a Pagar (continuação tracejada) */}
                      <Line 
                        type="monotone" 
                        dataKey="totalProj" 
                        name="Total a Pagar"
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={(props: any) => {
                          const { payload } = props;
                          if (!payload || payload.totalProj === null || payload.totalProj === undefined) {
                            // Return an empty SVG element instead of null
                            return <g />;
                          }
                          return (
                            <circle
                              cx={props.cx}
                              cy={props.cy}
                              r={3}
                              fill="hsl(var(--primary))"
                              fillOpacity={0.5}
                            />
                          );
                        }}
                        connectNulls={true}
                        opacity={0.5}
                        legendType="none"
                      />
                      {/* Linha histórica de Total Pago */}
                      <Line 
                        type="monotone" 
                        dataKey="pago" 
                        name="Total Pago"
                        stroke="hsl(142, 71%, 45%)" 
                        strokeWidth={2}
                        dot={(props: any) => {
                          const { payload } = props;
                          if (!payload || payload.pago === null || payload.pago === undefined) {
                            // Return an empty SVG element instead of null
                            return <g />;
                          }
                          return (
                            <circle
                              cx={props.cx}
                              cy={props.cy}
                              r={3}
                              fill="hsl(142, 71%, 45%)"
                            />
                          );
                        }}
                        connectNulls={true}
                      />
                      {/* Linha projetada de Total Pago (continuação tracejada) */}
                      <Line 
                        type="monotone" 
                        dataKey="pagoProj" 
                        name="Total Pago"
                        stroke="hsl(142, 71%, 45%)" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={(props: any) => {
                          const { payload } = props;
                          if (!payload || payload.pagoProj === null || payload.pagoProj === undefined) {
                            // Return an empty SVG element instead of null
                            return <g />;
                          }
                          return (
                            <circle
                              cx={props.cx}
                              cy={props.cy}
                              r={3}
                              fill="hsl(142, 71%, 45%)"
                              fillOpacity={0.5}
                            />
                          );
                        }}
                        connectNulls={true}
                        opacity={0.5}
                        legendType="none"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    <p className="text-sm">Carregando dados do gráfico...</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <i className='bx bx-credit-card text-xl text-blue-500'></i>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Limite Total</p>
                <p className="text-xl font-bold">{formatCurrency(totalLimit)}</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <i className='bx bx-minus-circle text-xl text-negative'></i>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Limite Usado</p>
                <p className="text-xl font-bold text-negative">{formatCurrency(totalUsed)}</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <i className='bx bx-check-circle text-xl text-positive'></i>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Limite Disponivel</p>
                <p className="text-xl font-bold text-positive">{formatCurrency(totalAvailable)}</p>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Search */}
      <div className="glass-card p-4">
        <div className="relative">
          <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'></i>
          <Input
            placeholder="Buscar cartões..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <i className='bx bx-loader-alt bx-spin text-4xl text-primary'></i>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <i className='bx bx-credit-card text-6xl text-muted-foreground mb-4'></i>
          <h3 className="text-lg font-medium mb-2">Nenhum cartão encontrado</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando seu primeiro cartão de crédito'}
          </p>
          {!searchTerm && (
            <Button onClick={openNewForm}>
              <i className='bx bx-plus mr-2'></i>
              Adicionar Cartão
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCards.map((card) => {
            const isExpired = card.is_expired || false;
            return (
            <div
              key={card.id}
              className={`glass-card p-3 hover:shadow-lg transition-shadow ${isExpired ? 'opacity-60' : ''}`}
            >
              {/* Visual Credit Card - Realistic Design */}
              <div
                className={`relative overflow-hidden rounded-xl ${isExpired ? 'opacity-75' : ''}`}
                style={{
                  background: `linear-gradient(135deg, ${card.color || '#1a1a2e'} 0%, ${card.color ? card.color + 'cc' : '#0f3460'} 50%, ${card.color || '#1a1a2e'} 100%)`,
                  aspectRatio: '1.586/1',
                }}
              >
                {/* Glossy overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none rounded-xl" />

                {/* Abstract decorative circles */}
                <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-white/5" />
                <div className="absolute -right-4 top-6 w-16 h-16 rounded-full bg-white/5" />
                <div className="absolute -left-6 -bottom-6 w-20 h-20 rounded-full bg-black/10" />

                <div className="relative z-10 h-full p-3 flex flex-col justify-between text-white">
                  {/* Top Row: Institution, Name & Actions */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-white/80 text-[10px] font-medium tracking-wide uppercase">
                          {card.institution || 'Cartão'}
                        </p>
                        {isExpired && (
                          <span className="px-1 py-0.5 bg-red-500/90 text-white text-[8px] font-bold rounded uppercase">
                            Expirado
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold tracking-wide">{card.name}</h3>
                    </div>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => openEditForm(card)}
                        className="p-1 hover:bg-white/20 rounded transition-colors"
                        disabled={isExpired}
                        title={isExpired ? 'Cartão expirado' : 'Editar cartão'}
                      >
                        <i className='bx bx-edit text-xs'></i>
                      </button>
                      <button
                        onClick={() => {
                          setCardToDelete(card);
                          setDeleteDialogOpen(true);
                        }}
                        className="p-1 hover:bg-red-500/40 rounded transition-colors"
                        title="Excluir cartão"
                      >
                        <i className='bx bx-trash text-xs'></i>
                      </button>
                    </div>
                  </div>

                  {/* Middle: Chip & Card Number */}
                  <div className="flex items-center gap-3">
                    {/* EMV Chip */}
                    <div
                      className="w-8 h-5 rounded flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, #d4af37 0%, #f2d06b 25%, #d4af37 50%, #b8860b 75%, #d4af37 100%)',
                        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 1px rgba(0,0,0,0.2)'
                      }}
                    >
                      <div className="w-full h-full grid grid-cols-3 gap-[1px] p-[2px]">
                        <div className="bg-black/10 rounded-[1px]" />
                        <div className="bg-black/10 rounded-[1px]" />
                        <div className="bg-black/10 rounded-[1px]" />
                        <div className="bg-black/10 rounded-[1px]" />
                        <div className="bg-black/10 rounded-[1px]" />
                        <div className="bg-black/10 rounded-[1px]" />
                      </div>
                    </div>

                    {/* Card Number */}
                    <p className="text-sm font-mono tracking-[0.15em] font-medium text-white drop-shadow-sm">
                      {card.last_four_digits
                        ? `•••• •••• •••• ${card.last_four_digits}`
                        : '•••• •••• •••• ••••'}
                    </p>
                  </div>

                  {/* Bottom Row: Info & Brand */}
                  <div className="flex justify-between items-end">
                    <div className="flex gap-3">
                      <div>
                        <p className="text-white/60 text-[8px] uppercase tracking-wider">Venc. Fatura</p>
                        <p className="font-semibold text-[10px]">Dia {card.due_day}</p>
                      </div>
                      <div>
                        <p className="text-white/60 text-[8px] uppercase tracking-wider">Fechamento</p>
                        <p className="font-semibold text-[10px]">Dia {card.closing_day}</p>
                      </div>
                      {card.expiration_date && (
                        <div>
                          <p className="text-white/60 text-[8px] uppercase tracking-wider">Expira</p>
                          <p className="font-semibold text-[10px]">
                            {new Date(card.expiration_date).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' })}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Card Brand Logo */}
                    <div className="flex items-center">
                      {card.card_brand === 'visa' && (
                        <div className="text-white font-bold text-base italic tracking-tight" style={{ fontFamily: 'Arial, sans-serif' }}>
                          VISA
                        </div>
                      )}
                      {card.card_brand === 'mastercard' && (
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full bg-red-500 -mr-1.5" />
                          <div className="w-4 h-4 rounded-full bg-yellow-500 opacity-90" />
                        </div>
                      )}
                      {card.card_brand === 'elo' && (
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-yellow-400 -mr-1" />
                          <div className="w-3 h-3 rounded-full bg-red-500 -mr-1" />
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                        </div>
                      )}
                      {card.card_brand === 'amex' && (
                        <div className="text-white font-bold text-[10px] tracking-wider">
                          AMEX
                        </div>
                      )}
                      {card.card_brand === 'hipercard' && (
                        <div className="text-white font-bold text-[10px] tracking-wider text-red-400">
                          HIPER
                        </div>
                      )}
                      {card.card_brand === 'diners' && (
                        <div className="text-white font-bold text-[10px] tracking-wider">
                          DINERS
                        </div>
                      )}
                      {(!card.card_brand || card.card_brand === 'other') && (
                        <span className="text-lg">{card.icon || '💳'}</span>
                      )}
                    </div>
                  </div>

                  {/* Assigned user badge */}
                  {card.assigned_to_profile && (
                    <div className="absolute top-8 left-3 flex items-center gap-1 bg-black/20 backdrop-blur-sm rounded-full px-1.5 py-0.5">
                      {card.assigned_to_profile.avatar_url ? (
                        <img
                          src={card.assigned_to_profile.avatar_url}
                          alt={card.assigned_to_profile.full_name || 'Avatar'}
                          className="w-3 h-3 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-white/30 flex items-center justify-center text-white text-[8px] font-bold">
                          {(card.assigned_to_profile.full_name || card.assigned_to_profile.email)[0].toUpperCase()}
                        </div>
                      )}
                      <span className="text-[8px] text-white/90 font-medium max-w-[80px] truncate">
                        {card.assigned_to_profile.full_name || card.assigned_to_profile.email}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Limit Usage - Compact */}
              <div className="mt-2 pt-2 border-t border-border/50">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-muted-foreground">Limite Utilizado</span>
                  <span className={`font-medium ${card.usage_percentage >= 70 ? 'text-orange-500' : 'text-primary'}`}>
                    {card.usage_percentage}% ({formatCurrency(card.used_limit_cents)})
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Disponível: {formatCurrency(card.available_limit_cents)}</span>
                  <span>Limite: {formatCurrency(card.credit_limit_cents)}</span>
                </div>
              </div>

              {/* Additional Card Info */}
              <div className="space-y-2">
                {/* Card Bills Consolidation */}
                {(() => {
                  const cardBills = cardBillsMap.get(card.id) || [];
                  
                  // Usar o mês selecionado ao invés do mês atual
                  const monthToUse = selectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                  const [year, month] = monthToUse.split('-');
                  const selectedMonthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                  const selectedMonthStr = selectedMonthDate.toISOString().split('T')[0].substring(0, 7);
                  
                  // Buscar faturas do mês selecionado
                  const selectedMonthCardBills = cardBills.filter(bill => {
                    const billMonth = bill.reference_month.substring(0, 7);
                    return billMonth === selectedMonthStr;
                  });

                  if (selectedMonthCardBills.length === 0) return null;

                  // Pegar a primeira fatura do mês selecionado (ou a mais recente)
                  const selectedBill = selectedMonthCardBills[0];
                  
                  const cardTotalToPay = selectedMonthCardBills.reduce((sum, bill) => sum + bill.total_cents, 0);
                  const cardTotalPaid = selectedMonthCardBills.reduce((sum, bill) => sum + bill.paid_cents, 0);
                  const cardRemaining = cardTotalToPay - cardTotalPaid;

                  return (
                    <div className="border-t border-border/50 pt-2 mt-2">
                      {selectedBill && (
                        <div className="flex items-center justify-between mb-1.5">
                          <h5 className="text-[10px] font-medium flex items-center gap-1">
                            <i className='bx bx-file text-[10px]'></i>
                            Fatura {selectedMonthStr}
                          </h5>
                          {getStatusBadge(selectedBill.status)}
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-semibold">{formatCurrency(selectedBill?.total_cents || 0)}</span>
                        <span className={`text-[10px] ${cardRemaining > 0 ? 'text-orange-500' : 'text-positive'}`}>
                          Restante: {formatCurrency(cardRemaining)}
                        </span>
                      </div>
                      {cardTotalToPay > 0 && (
                        <div className="h-1 bg-muted rounded-full overflow-hidden mb-1.5">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${Math.min(100, (cardTotalPaid / cardTotalToPay) * 100)}%` }}
                          />
                        </div>
                      )}
                      {selectedBill && (
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-[10px] h-6 px-2"
                            onClick={() => openBillDetail(card.id, selectedBill.id)}
                            disabled={isExpired}
                          >
                            <i className='bx bx-show mr-1 text-[10px]'></i>
                            Detalhes
                          </Button>
                          {selectedBill.status !== 'paid' && !isExpired && (
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1 text-[10px] h-6 px-2"
                              onClick={() => handlePayBill(card.id, selectedBill)}
                            >
                              <i className='bx bx-money mr-1 text-[10px]'></i>
                              Pagar
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Card Transactions - Compact */}
                {(() => {
                  const cardTransactions = cardTransactionsMap.get(card.id) || [];
                  if (cardTransactions.length === 0) return null;

                  return (
                    <div className="border-t border-border/50 pt-2 mt-2">
                      <h4 className="font-medium mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <i className='bx bx-list-ul text-[10px]'></i>
                        Últimas transações ({cardTransactions.length})
                      </h4>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {cardTransactions
                          .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime())
                          .slice(0, 3)
                          .map((tx: any) => (
                            <div
                              key={tx.id}
                              className="flex items-center gap-1.5 text-[10px]"
                            >
                              <span className="flex-1 truncate text-muted-foreground">{tx.description}</span>
                              <span className={`font-medium flex-shrink-0 ${tx.amount_cents >= 0 ? 'text-negative' : 'text-positive'}`}>
                                {formatCurrency(Math.abs(tx.amount_cents))}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Interest Rates */}
                {(card.interest_rate_monthly > 0 || card.interest_rate_annual > 0) && (
                  <div className="flex gap-3 text-[10px] text-muted-foreground border-t border-border/50 pt-2 mt-2">
                    {card.interest_rate_monthly > 0 && (
                      <span>Juros: {card.interest_rate_monthly.toFixed(2)}% a.m.</span>
                    )}
                    {card.interest_rate_annual > 0 && (
                      <span>CET: {card.interest_rate_annual.toFixed(2)}% a.a.</span>
                    )}
                  </div>
                )}

                {/* Expired Warning */}
                {isExpired && (
                  <div className="border-t border-border/50 pt-2 mt-2">
                    <div className="flex items-center gap-1.5 p-1.5 bg-negative/10 border border-red-500/20 rounded">
                      <i className='bx bx-error-circle text-negative text-[10px]'></i>
                      <p className="text-[10px] text-negative font-medium">
                        Cartão expirado
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Credit Card Form Dialog */}
      <CreditCardForm
        open={formOpen}
        onOpenChange={setFormOpen}
        card={editingCard}
        onSuccess={handleFormSuccess}
        cardBrands={cardBrands}
        cardColors={cardColors}
      />

      {/* Bill Detail Modal */}
      {selectedBill && (
        <BillDetailModal
          open={billDetailOpen}
          onOpenChange={handleBillDetailClose}
          cardId={selectedBill.cardId}
          billId={selectedBill.billId}
          onPaymentSuccess={async () => {
            await fetchCards();
            const updatedCards = await fetch('/api/credit-cards').then(r => r.json()).then(d => d.data || []);
            if (updatedCards.length > 0) {
              fetchCurrentMonthBills(updatedCards);
            }
          }}
        />
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Cartão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o cartão "{cardToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Bill Transaction Form */}
      {selectedBillForPayment && selectedBillForPayment.categoryId && (
        <TransactionForm
          open={payBillDialogOpen}
          onOpenChange={(open) => {
            setPayBillDialogOpen(open);
            if (!open) {
              setSelectedBillForPayment(null);
            }
          }}
          onSubmit={handleTransactionSubmit}
          transaction={{
            account_id: accounts.length > 0 ? accounts[0].id : '',
            category_id: selectedBillForPayment.categoryId,
            posted_at: new Date().toISOString().split('T')[0],
            description: `Pagamento fatura ${selectedBillForPayment.cardName}`,
            amount: (selectedBillForPayment.remainingAmount / 100).toFixed(2),
          }}
          accounts={accounts}
          creditCards={[]}
          categories={categories}
        />
      )}
    </div>
  );
}
