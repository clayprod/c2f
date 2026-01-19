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
import CreditCardForm from '@/components/credit-cards/CreditCardForm';
import BillDetailModal from '@/components/credit-cards/BillDetailModal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, PieChart, Pie, Cell } from 'recharts';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { formatMonthYear } from '@/lib/utils';
import { InfoIcon } from '@/components/ui/InfoIcon';

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
  const { toast } = useToast();

  useEffect(() => {
    fetchCards();
  }, []);

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

          // Buscar transações do mês corrente para este cartão
          if (currentBills.length > 0) {
            const billIds = currentBills.map(b => b.id);
            try {
              const txRes = await fetch(`/api/transactions?account_id=${card.id}&limit=100`);
              const txData = await txRes.json();
              const allTransactions = txData.data || [];
              
              // Filtrar transações que pertencem às faturas do mês corrente
              const billTransactions = allTransactions.filter((tx: any) => 
                tx.credit_card_bill_id && billIds.includes(tx.credit_card_bill_id)
              );
              
              transactionsMap.set(card.id, billTransactions);
            } catch (error) {
              console.error(`Error fetching transactions for card ${card.id}:`, error);
            }
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
        let projected = 0;

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
          // Calcular projeção baseada em transações parceladas futuras
          for (const card of cardsList) {
            try {
              // Buscar transações parceladas futuras
              const txRes = await fetch(`/api/transactions?account_id=${card.id}&limit=500`);
              const txData = await txRes.json();
              const transactions = txData.data || [];

              // Filtrar transações parceladas que se aplicam a este mês
              transactions.forEach((tx: any) => {
                if (tx.installment_number && tx.installment_total && tx.installment_number < tx.installment_total) {
                  // Transações parceladas - calcular se esta parcela cai neste mês
                  const txDate = new Date(tx.posted_at);
                  const monthsDiff = (monthDate.getFullYear() - txDate.getFullYear()) * 12 + 
                                    (monthDate.getMonth() - txDate.getMonth());
                  
                  // Verificar se esta parcela específica cai no mês projetado
                  if (monthsDiff > 0) {
                    const parcelNumber = tx.installment_number + monthsDiff;
                    if (parcelNumber <= tx.installment_total) {
                      // O valor da transação já é o valor da parcela individual
                      projected += Math.abs(Math.round((tx.amount || 0) * 100));
                    }
                  }
                }
              });
            } catch (error) {
              console.error(`Error fetching transactions for projection: ${card.id}`, error);
            }
          }
          totalToPay = projected;
        }

        const monthInfoResult = formatMonthYear(monthDate, { returnCurrentMonthInfo: true });
        const monthLabel = typeof monthInfoResult === 'string' ? monthInfoResult : monthInfoResult.formatted;
        const isCurrentMonth = typeof monthInfoResult === 'object' ? monthInfoResult.isCurrentMonth : false;
        const isProjected = monthInfo.type === 'projection';
        
        // Para criar continuidade visual: primeiro ponto projetado também tem valor histórico (último histórico)
        // Último ponto histórico também tem valor projetado (mesmo valor) para conectar
        const isFirstProjected = isProjected && chartDataPoints.length > 0 && !chartDataPoints[chartDataPoints.length - 1].isProjected;
        const isLastHistorical = !isProjected && chartDataPoints.length > 0 && chartDataPoints[chartDataPoints.length - 1].isProjected === false;
        
        chartDataPoints.push({
          month: monthLabel,
          total: !isProjected ? totalToPay / 100 : (isFirstProjected ? lastHistoricalTotal : null),
          totalProj: isProjected ? totalToPay / 100 : (isLastHistorical ? lastHistoricalTotal : null),
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
        throw new Error(error.error || 'Erro ao excluir cartao');
      }

      toast({
        title: 'Sucesso',
        description: 'Cartao excluido',
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
      const [year, month] = monthStr.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      let allTransactions: any[] = [];

      if (cardId) {
        // Fetch transactions for selected card
        const params = new URLSearchParams({
          from_date: startDate,
          to_date: endDate,
          type: 'expense',
          account_id: cardId,
        });
        const res = await fetch(`/api/transactions?${params.toString()}`);
        const data = await res.json();
        allTransactions = data.data || [];
      } else {
        // Fetch transactions from all credit cards
        for (const card of cards) {
          const cardParams = new URLSearchParams({
            from_date: startDate,
            to_date: endDate,
            type: 'expense',
            account_id: card.id,
          });
          const res = await fetch(`/api/transactions?${cardParams.toString()}`);
          const data = await res.json();
          if (data.data) {
            allTransactions.push(...data.data);
          }
        }
      }

      // Group by category
      const categoryMap = new Map<string, { name: string; value: number; color: string }>();
      
      allTransactions.forEach((tx: any) => {
        if (tx.category_id && tx.categories) {
          const categoryId = tx.category_id;
          const categoryName = tx.categories.name || 'Sem categoria';
          const amount = Math.abs(Math.round((tx.amount || 0) * 100));
          
          if (categoryMap.has(categoryId)) {
            const existing = categoryMap.get(categoryId)!;
            existing.value += amount;
            categoryMap.set(categoryId, existing);
          } else {
            categoryMap.set(categoryId, {
              name: categoryName,
              value: amount,
              color: tx.categories.color || '#6b7280',
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
  }, [selectedMonth, selectedCardId, cards]);

  const openBillDetail = (cardId: string, billId: string) => {
    setSelectedBill({ cardId, billId });
    setBillDetailOpen(true);
  };

  const filteredCards = cards.filter(card =>
    card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.institution?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: Bill['status']) => {
    const styles = {
      open: 'bg-blue-500/20 text-blue-500',
      closed: 'bg-yellow-500/20 text-yellow-500',
      paid: 'bg-green-500/20 text-green-500',
      partial: 'bg-orange-500/20 text-orange-500',
      overdue: 'bg-red-500/20 text-red-500',
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
                    <p className="text-2xl font-bold text-green-500">{formatCurrency(currentMonthSummary.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Restante</p>
                    <p className={`text-2xl font-bold ${currentMonthSummary.remaining > 0 ? 'text-orange-500' : 'text-green-500'}`}>
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
                        formatter={(value: number) => formatCurrency(value * 100)}
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
                <i className='bx bx-minus-circle text-xl text-red-500'></i>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Limite Usado</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(totalUsed)}</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <i className='bx bx-check-circle text-xl text-green-500'></i>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Limite Disponivel</p>
                <p className="text-xl font-bold text-green-500">{formatCurrency(totalAvailable)}</p>
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
          <h3 className="text-lg font-medium mb-2">Nenhum cartao encontrado</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando seu primeiro cartao de credito'}
          </p>
          {!searchTerm && (
            <Button onClick={openNewForm}>
              <i className='bx bx-plus mr-2'></i>
              Adicionar Cartao
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCards.map((card) => {
            const isExpired = card.is_expired || false;
            return (
            <div
              key={card.id}
              className={`glass-card overflow-hidden hover:shadow-lg transition-shadow ${isExpired ? 'opacity-60' : ''}`}
            >
              {/* Card Header (Visual Credit Card) */}
              <div
                className={`p-4 text-white relative overflow-hidden ${isExpired ? 'opacity-75' : ''}`}
                style={{ backgroundColor: card.color || '#1a1a2e' }}
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white translate-y-1/2 -translate-x-1/2" />
                </div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white/70 text-xs">{card.institution || 'Cartao'}</p>
                        {isExpired && (
                          <span className="px-1.5 py-0.5 bg-red-500/80 text-white text-[10px] font-medium rounded">
                            Expirado
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold">{card.name}</h3>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditForm(card)}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        disabled={isExpired}
                        title={isExpired ? 'Cartão expirado' : 'Editar cartão'}
                      >
                        <i className='bx bx-edit text-sm'></i>
                      </button>
                      <button
                        onClick={() => {
                          setCardToDelete(card);
                          setDeleteDialogOpen(true);
                        }}
                        className="p-1.5 hover:bg-red-500/30 rounded-lg transition-colors"
                        title="Excluir cartão"
                      >
                        <i className='bx bx-trash text-sm'></i>
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-base tracking-widest font-medium">
                      {card.last_four_digits ? `**** **** **** ${card.last_four_digits}` : '**** **** **** 0000'}
                    </p>
                  </div>

                  <div className="flex justify-between items-end gap-1.5">
                    <div>
                      <p className="text-white/70 text-[10px]">Venc. Fatura</p>
                      <p className="font-medium text-xs">Dia {card.due_day}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/70 text-[10px]">Fechamento</p>
                      <p className="font-medium text-xs">Dia {card.closing_day}</p>
                    </div>
                    {card.expiration_date && (
                      <div className="text-center">
                        <p className="text-white/70 text-[10px]">Expira</p>
                        <p className="font-medium text-xs">
                          {new Date(card.expiration_date).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' })}
                        </p>
                      </div>
                    )}
                    <div className="text-right flex items-end gap-1.5">
                      {cardBrands.find(b => b.value === card.card_brand)?.label && (
                        <p className="text-white/90 text-[10px] font-medium uppercase tracking-wider">
                          {cardBrands.find(b => b.value === card.card_brand)?.label}
                        </p>
                      )}
                      <span className="text-lg">{card.icon}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-3 space-y-3">
                {/* Limit Usage Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Limite Utilizado</span>
                    <span className="font-medium">
                      {card.usage_percentage}% ({formatCurrency(card.used_limit_cents)})
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${getUsageBarColor(card.usage_percentage)}`}
                      style={{ width: `${Math.min(100, card.usage_percentage)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                    <span>Disponivel: {formatCurrency(card.available_limit_cents)}</span>
                    <span>Limite: {formatCurrency(card.credit_limit_cents)}</span>
                  </div>
                </div>

                {/* Card Bills Consolidation */}
                {(() => {
                  const cardBills = cardBillsMap.get(card.id) || [];
                  const now = new Date();
                  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                  const currentMonthStr = currentMonth.toISOString().split('T')[0].substring(0, 7);
                  
                  const currentMonthCardBills = cardBills.filter(bill => {
                    const billMonth = bill.reference_month.substring(0, 7);
                    return billMonth === currentMonthStr;
                  });

                  if (currentMonthCardBills.length === 0) return null;

                  const cardTotalToPay = currentMonthCardBills.reduce((sum, bill) => sum + bill.total_cents, 0);
                  const cardTotalPaid = currentMonthCardBills.reduce((sum, bill) => sum + bill.paid_cents, 0);
                  const cardRemaining = cardTotalToPay - cardTotalPaid;

                  return (
                    <div className="border-t border-border pt-3">
                      {card.current_bill && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-medium flex items-center gap-1.5">
                              <i className='bx bx-file text-xs'></i>
                              Fatura Atual
                            </h5>
                            {getStatusBadge(card.current_bill.status)}
                          </div>
                          <div className="mb-2">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Total</p>
                            <p className="font-semibold text-sm">{formatCurrency(card.current_bill.total_cents)}</p>
                          </div>
                        </>
                      )}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Total Pago</p>
                          <p className="font-semibold text-xs text-green-500">{formatCurrency(cardTotalPaid)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Restante</p>
                          <p className={`font-semibold text-xs ${cardRemaining > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                            {formatCurrency(cardRemaining)}
                          </p>
                        </div>
                      </div>
                      {cardTotalToPay > 0 && (
                        <div className="mb-2">
                          <div className="flex justify-between text-[10px] mb-0.5">
                            <span className="text-muted-foreground">Progresso</span>
                            <span className="font-medium">
                              {Math.round((cardTotalPaid / cardTotalToPay) * 100)}%
                            </span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all"
                              style={{ width: `${Math.min(100, (cardTotalPaid / cardTotalToPay) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {card.current_bill && (
                        <>
                          <div className="mb-2">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Vencimento</p>
                            <p className="font-medium text-xs">{formatDate(card.current_bill.due_date)}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-7"
                            onClick={() => openBillDetail(card.id, card.current_bill!.id)}
                            disabled={isExpired}
                            title={isExpired ? 'Cartão expirado - não é possível visualizar faturas' : 'Ver detalhes da fatura'}
                          >
                            <i className='bx bx-show mr-1.5 text-xs'></i>
                            Ver Detalhes da Fatura
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Card Transactions */}
                {(() => {
                  const cardTransactions = cardTransactionsMap.get(card.id) || [];
                  if (cardTransactions.length === 0) return null;

                  return (
                    <div className="border-t border-border pt-3">
                      <h4 className="font-medium mb-2 flex items-center gap-1.5 text-xs">
                        <i className='bx bx-list-ul text-xs'></i>
                        Transações do Mês ({cardTransactions.length})
                      </h4>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {cardTransactions
                          .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime())
                          .slice(0, 10)
                          .map((tx: any) => (
                            <div
                              key={tx.id}
                              className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                              <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs"
                                style={{
                                  backgroundColor: (tx.category?.color || '#6b7280') + '20'
                                }}
                              >
                                {tx.category?.icon || '📝'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs truncate">{tx.description}</p>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <span>{formatDate(tx.posted_at)}</span>
                                  {tx.category && <span>• {tx.category.name}</span>}
                                </div>
                              </div>
                              <p className={`font-semibold text-xs flex-shrink-0 ${tx.amount_cents < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {formatCurrency(Math.abs(tx.amount_cents))}
                              </p>
                            </div>
                          ))}
                        {cardTransactions.length > 10 && (
                          <p className="text-[10px] text-muted-foreground text-center pt-1.5">
                            Mostrando 10 de {cardTransactions.length} transações
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Interest Rates */}
                {(card.interest_rate_monthly > 0 || card.interest_rate_annual > 0) && (
                  <div className="flex gap-4 text-xs text-muted-foreground border-t border-border pt-3">
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
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <i className='bx bx-error-circle text-red-500 text-sm'></i>
                      <p className="text-xs text-red-500 font-medium">
                        Este cartão expirou e não pode ser mais utilizado
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
            <DialogTitle>Excluir Cartao</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o cartao "{cardToDelete?.name}"?
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
    </div>
  );
}
