'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import ImportGuide from './ImportGuide';
import { formatCurrencyValue, formatDate } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  accounts: Array<{ id: string; name: string }>;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
}

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  selected: boolean;
  category_id: string | null;
  category_name: string | null;
  account_id: string | null;
  needs_category_creation: boolean;
  ai_suggested: boolean;
  ai_confidence?: 'low' | 'medium' | 'high';
  // Open Finance metadata
  link_id?: string;
  account_name?: string;
}

interface PreviewStats {
  total: number;
  with_category: number;
  needs_creation: number;
  ai_suggested: number;
}

type ImportType = 'csv' | 'ofx' | 'openfinance';
type ImportStep = 'upload' | 'preview' | 'importing' | 'completed';

interface AccountLink {
  id: string;
  pluggy_account: {
    name: string;
    institution_name: string;
  };
}

export default function ImportModal({
  open,
  onOpenChange,
  onSuccess,
  accounts,
}: ImportModalProps) {
  const [importType, setImportType] = useState<ImportType>('csv');
  const [file, setFile] = useState<File | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [step, setStep] = useState<ImportStep>('upload');
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  
  // Memoized category name map for O(1) lookups
  const categoryNameMap = useMemo(() => 
    new Map(categories.map(c => [c.name.toLowerCase(), c.id])),
    [categories]
  );
  
  // Refs for abort control and request tracking
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  
  // Open Finance states
  const [openFinanceAvailable, setOpenFinanceAvailable] = useState(false);
  const [openFinanceLoading, setOpenFinanceLoading] = useState(false);
  const [accountLinks, setAccountLinks] = useState<AccountLink[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string>('all');
  const [batchSize, setBatchSize] = useState<5 | 10 | 25 | 50 | 100>(10);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [progress, setProgress] = useState<{
    status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
    message?: string;
    result?: {
      totalRows: number;
      imported: number;
      skipped: number;
      errors: string[];
    };
  }>({ status: 'idle' });
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Cleanup when modal closes
  useEffect(() => {
    if (!open) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    }
  }, [open]);

  // Fetch categories and check Open Finance availability when modal opens
  useEffect(() => {
    if (open) {
      fetchCategories();
      checkOpenFinanceAvailability();
    }
  }, [open]);

  const checkOpenFinanceAvailability = async () => {
    try {
      const res = await fetch('/api/pluggy/availability');
      if (!res.ok) {
        setOpenFinanceAvailable(false);
        return;
      }
      const data = await res.json();
      setOpenFinanceAvailable(data.available && data.hasLinkedAccounts);
      if (data.available) {
        fetchAccountLinks();
      }
    } catch (error) {
      console.error('Error checking Open Finance availability:', error);
      setOpenFinanceAvailable(false);
    }
  };

  const fetchAccountLinks = async () => {
    try {
      const res = await fetch('/api/pluggy/links');
      if (!res.ok) return;
      const data = await res.json();
      setAccountLinks((data.data || []).map((link: any) => ({
        id: link.id,
        pluggy_account: {
          name: link.pluggy_account?.name || 'Conta',
          institution_name: link.pluggy_account?.institution_name || 'Open Finance',
        },
      })));
    } catch (error) {
      console.error('Error fetching account links:', error);
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

  const acceptedTypes = importType === 'csv'
    ? '.csv,text/csv'
    : '.ofx,.qfx,application/x-ofx';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    const isValid = importType === 'csv'
      ? fileName.endsWith('.csv')
      : fileName.endsWith('.ofx') || fileName.endsWith('.qfx');

    if (!isValid) {
      toast({
        title: 'Formato de arquivo inválido',
        description: `Por favor, selecione um arquivo ${importType.toUpperCase()} válido`,
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setProgress({ status: 'idle' });
    setShowGuide(false);
  };

  const handlePreview = async () => {
    // Cancel any pending request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const currentRequestId = ++requestIdRef.current;

    // Handle Open Finance import
    if (importType === 'openfinance') {
      await fetchOpenFinanceTransactions();
      return;
    }

    // Handle CSV/OFX import
    if (!file) {
      toast({
        title: 'Nenhum arquivo selecionado',
        description: 'Por favor, selecione um arquivo para importar',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      setProgress({ status: 'uploading', message: 'Lendo arquivo...' });

      const fileContent = await file.text();

      // Check if component is still mounted and request is still valid
      if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
        return;
      }

      setProgress({ status: 'processing', message: 'Analisando transações...' });

      // Call preview API with account_id
      const endpoint = importType === 'csv' ? '/api/import/csv/preview' : '/api/import/ofx/preview';
      const bodyKey = importType === 'csv' ? 'csv_content' : 'ofx_content';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [bodyKey]: fileContent,
          account_id: selectedAccountId || undefined,
        }),
        signal: abortControllerRef.current.signal,
      });

      // Check if request was cancelled or component unmounted
      if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erro ao processar ${importType.toUpperCase()}`);
      }

      // Convert to ParsedTransaction format
      const parsedTransactions: ParsedTransaction[] = (data.transactions || []).map(
        (tx: any) => ({
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          selected: true,
          category_id: tx.category_id || null,
          category_name: tx.category_name || null,
          account_id: tx.account_id || null,
          needs_category_creation: tx.needs_category_creation || false,
          ai_suggested: tx.ai_suggested || false,
          ai_confidence: tx.ai_confidence,
        })
      );

      setTransactions(parsedTransactions);
      setPreviewStats(data.stats || null);
      setStep('preview');
      setProgress({ status: 'idle' });

      // Show toast with categorization stats
      if (data.stats) {
        const { with_category, needs_creation, ai_suggested } = data.stats;
        if (with_category > 0) {
          toast({
            title: 'Categorização automática',
            description: `${with_category} transações já categorizadas${
              ai_suggested > 0 ? `, ${ai_suggested} sugeridas pela IA` : ''
            }${needs_creation > 0 ? `, ${needs_creation} novas categorias` : ''}`,
          });
        }
      }
    } catch (error: any) {
      // Ignore abort errors
      if (error.name === 'AbortError') {
        return;
      }

      setProgress({
        status: 'error',
        message: error.message || `Erro ao processar ${importType.toUpperCase()}`,
      });
      toast({
        title: 'Falha no processamento',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenFinanceTransactions = async () => {
    setOpenFinanceLoading(true);
    setLoading(true);
    setProgress({ status: 'processing', message: 'Buscando transações...' });

    try {
      const params = new URLSearchParams({ batch_size: String(batchSize) });
      if (selectedLinkId !== 'all') {
        params.set('link_id', selectedLinkId);
      }

      const res = await fetch(`/api/pluggy/pending-transactions?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao buscar transações');
      }

      if (!data.transactions || data.transactions.length === 0) {
        toast({
          title: 'Nenhuma transação encontrada',
          description: 'Não há transações pendentes para importar',
        });
        setProgress({ status: 'idle' });
        return;
      }

      // Convert to ParsedTransaction format with link metadata
      // Apply sign based on type: debit = negative (expense), credit = positive (income)
      const parsedTransactions: ParsedTransaction[] = data.transactions.map((tx: any) => {
        const amountCents = Number(tx.amount_cents) || 0;
        const signedAmount = tx.type === 'debit' ? -Math.abs(amountCents) : Math.abs(amountCents);
        return {
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: signedAmount,
          type: tx.type === 'debit' ? 'expense' : 'income',
          selected: true,
          category_id: null,
          category_name: null,
          account_id: null,
          needs_category_creation: false,
          ai_suggested: false,
          // Store link metadata for import
          link_id: tx.link_id,
          account_name: tx.account_name,
        };
      });

      setTransactions(parsedTransactions);
      setStep('preview');
      setProgress({ status: 'idle' });

      // Auto-categorize with AI
      if (parsedTransactions.length > 0) {
        await categorizeWithAI(parsedTransactions);
      }
    } catch (error: any) {
      setProgress({
        status: 'error',
        message: error.message || 'Erro ao buscar transações',
      });
      toast({
        title: 'Falha ao buscar transações',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setOpenFinanceLoading(false);
      setLoading(false);
    }
  };

  const categorizeWithAI = useCallback(async (txs: ParsedTransaction[]) => {
    // Cancel any pending request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const currentRequestId = ++requestIdRef.current;

    // Only categorize transactions without category
    const needingCategorization = txs.filter(tx => !tx.category_id);
    
    if (needingCategorization.length === 0) {
      return;
    }

    setCategorizing(true);
    try {
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: needingCategorization.map(tx => ({
            id: tx.id,
            description: tx.description,
            amount: tx.amount,
            date: tx.date,
          })),
        }),
        signal: abortControllerRef.current.signal,
      });

      // Check if request was cancelled
      if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
        return;
      }

      if (!res.ok) {
        console.warn('AI categorization failed');
        return;
      }

      const data = await res.json();

      // Create a map of transaction ID to categorization
      const categorizationMap = new Map(
        (data.transactions || []).map((cat: any) => [cat.id, cat])
      );

      // Create Set for O(1) lookup instead of O(n) find
      const needingIds = new Set(needingCategorization.map(t => t.id));

      // Update transactions with AI suggestions
      setTransactions(prev =>
        prev.map(tx => {
          // Only update if this transaction was in the batch (O(1) lookup)
          if (!needingIds.has(tx.id)) {
            return tx;
          }

          const aiResult = categorizationMap.get(tx.id) as any;
          if (aiResult && aiResult.category) {
            const categoryId = categoryNameMap.get(aiResult.category.toLowerCase());
            if (categoryId) {
              return {
                ...tx,
                category_id: categoryId,
                category_name: aiResult.category,
                ai_suggested: true,
                ai_confidence: aiResult.confidence,
              };
            }
          }
          return tx;
        })
      );

      toast({
        title: 'Categorização automática',
        description: `${needingCategorization.length} transações categorizadas pela IA. Você pode ajustar antes de importar.`,
      });
    } catch (error: any) {
      // Ignore abort errors
      if (error.name === 'AbortError') {
        return;
      }
      console.error('Error categorizing:', error);
    } finally {
      setCategorizing(false);
    }
  }, [categoryNameMap, toast]);

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

    try {
      setLoading(true);
      setStep('importing');
      setProgress({ status: 'processing', message: 'Importando transações...' });

      // Handle Open Finance import
      if (importType === 'openfinance') {
        await importOpenFinanceTransactions(selectedTransactions);
        return;
      }

      // Handle CSV/OFX import
      const fileContent = await file!.text();

      const endpoint = importType === 'csv' ? '/api/import/csv' : '/api/import/ofx';
      const bodyKey = importType === 'csv' ? 'csv_content' : 'ofx_content';

      // Prepare categories to create from selected transactions (O(n) with Map)
      const categoriesMap = new Map<string, { name: string; type: 'income' | 'expense' }>();
      selectedTransactions
        .filter(tx => tx.needs_category_creation && tx.category_name)
        .forEach(tx => {
          const key = `${tx.category_name!.toLowerCase()}_${tx.type}`;
          if (!categoriesMap.has(key)) {
            categoriesMap.set(key, {
              name: tx.category_name!,
              type: tx.type,
            });
          }
        });
      const categoriesToCreate = Array.from(categoriesMap.values());

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [bodyKey]: fileContent,
          account_id: selectedAccountId || undefined,
          categories: selectedTransactions.reduce((acc, tx) => {
            if (tx.category_id) {
              acc[tx.id] = tx.category_id;
            }
            return acc;
          }, {} as Record<string, string>),
          categories_to_create: categoriesToCreate,
          selected_ids: selectedTransactions.map(tx => tx.id),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erro ao importar ${importType.toUpperCase()}`);
      }

      setStep('completed');
      setProgress({
        status: 'completed',
        message: 'Importação concluída!',
        result: {
          totalRows: data.totalRows || 0,
          imported: data.imported || 0,
          skipped: data.skipped || 0,
          errors: data.errors || [],
        },
      });

      toast({
        title: 'Sucesso',
        description: `${data.imported || 0} transações importadas com sucesso`,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      setProgress({
        status: 'error',
        message: error.message || `Erro ao importar ${importType.toUpperCase()}`,
      });
      toast({
        title: 'Falha na importação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const importOpenFinanceTransactions = async (selectedTransactions: ParsedTransaction[]) => {
    try {
      // Group transactions by link_id for batch import
      const byLink = selectedTransactions.reduce((acc, tx) => {
        const linkId = (tx as any).link_id;
        if (linkId) {
          if (!acc[linkId]) acc[linkId] = [];
          acc[linkId].push(tx);
        }
        return acc;
      }, {} as Record<string, ParsedTransaction[]>);

      let totalImported = 0;
      let totalSkipped = 0;
      const allErrors: string[] = [];

      // Import each group
      for (const [linkId, txs] of Object.entries(byLink)) {
        const res = await fetch('/api/pluggy/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            link_id: linkId,
            transactions: txs.map(tx => ({
              id: tx.id,
              category_id: tx.category_id,
            })),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          allErrors.push(data.error || `Erro ao importar lote`);
          continue;
        }

        totalImported += data.results?.imported || 0;
        totalSkipped += data.results?.skipped || 0;
        if (data.results?.errors) {
          allErrors.push(...data.results.errors);
        }
      }

      setStep('completed');

      if (totalImported === 0 && totalSkipped === 0 && allErrors.length > 0) {
        const errorMessage = allErrors[0];
        setProgress({
          status: 'error',
          message: errorMessage || 'Erro ao importar transações',
        });
        toast({
          title: 'Falha na importação',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }

      setProgress({
        status: 'completed',
        message: allErrors.length > 0 ? 'Importação concluída com avisos.' : 'Importação concluída!',
        result: {
          totalRows: selectedTransactions.length,
          imported: totalImported,
          skipped: totalSkipped,
          errors: allErrors.slice(0, 5),
        },
      });

      if (allErrors.length > 0) {
        toast({
          title: 'Importação concluída com avisos',
          description: allErrors[0],
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: `${totalImported} transações importadas com sucesso`,
        });
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      setProgress({
        status: 'error',
        message: error.message || 'Erro ao importar transações',
      });
      toast({
        title: 'Falha na importação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Abort any pending requests
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    
    // Reset all states
    setFile(null);
    setSelectedAccountId('');
    setProgress({ status: 'idle' });
    setShowGuide(true);
    setStep('upload');
    setTransactions([]);
    setSelectAll(true);
    setPreviewStats(null);
    // Reset Open Finance states
    setSelectedLinkId('all');
    setBatchSize(10);
    onOpenChange(false);
  };

  const handleTypeChange = (type: ImportType) => {
    setImportType(type);
    setFile(null);
    setProgress({ status: 'idle' });
    setShowGuide(true);
    setStep('upload');
    setTransactions([]);
  };

  const handleBack = () => {
    setStep('upload');
    setTransactions([]);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setTransactions(prev => prev.map(tx => ({ ...tx, selected: checked })));
  };

  const handleSelectTransaction = (txId: string, checked: boolean) => {
    setTransactions(prev =>
      prev.map(tx => (tx.id === txId ? { ...tx, selected: checked } : tx))
    );
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

  const getConfidenceBadge = (confidence?: 'low' | 'medium' | 'high') => {
    if (!confidence) return null;
    const colors = {
      low: 'bg-negative/10 text-negative',
      medium: 'bg-yellow-500/10 text-yellow-500',
      high: 'bg-positive/10 text-positive',
    };
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${colors[confidence]}`}>
        IA
      </span>
    );
  };

  const selectedCount = transactions.filter(tx => tx.selected).length;

  // Pagination calculations
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const paginatedTransactions = transactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] !grid-cols-1 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Importar Transações</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Importe transações de contas bancárias (não suporta cartão de crédito) via CSV, OFX ou Open Finance'}
            {step === 'preview' && 'Revise e categorize as transações antes de importar'}
            {step === 'importing' && 'Importando transações...'}
            {step === 'completed' && 'Importação finalizada'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <>
            {/* Import Type Tabs */}
            <div className="flex border-b border-border shrink-0">
              <button
                onClick={() => handleTypeChange('csv')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                  importType === 'csv'
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <i className='bx bx-file mr-2'></i>
                Arquivo CSV
                {importType === 'csv' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => handleTypeChange('ofx')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                  importType === 'ofx'
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <i className='bx bx-bank mr-2'></i>
                Extrato OFX
                {importType === 'ofx' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              {openFinanceAvailable && (
                <button
                  onClick={() => handleTypeChange('openfinance')}
                  className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                    importType === 'openfinance'
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <i className='bx bx-link mr-2'></i>
                  Open Finance
                  {importType === 'openfinance' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              )}
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
                Importação disponível apenas para contas bancárias. Transações de cartão de crédito não devem ser importadas aqui.
              </div>
              {/* CSV/OFX: Account Selection and File Input */}
              {importType !== 'openfinance' && (
                <>
                  <div>
                    <label htmlFor="account-select" className="block text-sm font-medium mb-2">
                      Conta de destino (opcional)
                    </label>
                    <select
                      id="account-select"
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background"
                    >
                      <option value="">Usar conta padrão ou criar nova</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="file-input" className="block text-sm font-medium mb-2">
                      Arquivo {importType.toUpperCase()}
                    </label>
                    <input
                      id="file-input"
                      type="file"
                      accept={acceptedTypes}
                      onChange={handleFileChange}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                      disabled={loading}
                    />
                    {file && (
                      <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                        <i className='bx bx-check-circle text-positive'></i>
                        Arquivo selecionado: {file.name}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Open Finance: Account Link and Batch Size Selection */}
              {importType === 'openfinance' && (
                <>
                  <div>
                    <label htmlFor="link-select" className="block text-sm font-medium mb-2">
                      Conta vinculada
                    </label>
                    <select
                      id="link-select"
                      value={selectedLinkId}
                      onChange={(e) => setSelectedLinkId(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background"
                    >
                      <option value="all">Todas as contas vinculadas</option>
                      {accountLinks.map((link) => (
                        <option key={link.id} value={link.id}>
                          {link.pluggy_account.name} - {link.pluggy_account.institution_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Quantidade de transações
                    </label>
                    <div className="flex gap-2">
                      {([5, 10, 25, 50, 100] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setBatchSize(size)}
                          className={`flex-1 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                            batchSize === size
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-input hover:bg-muted'
                          }`}
                        >
                          Últimas {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Import Guide */}
              {showGuide && (
                <div className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium">Guia de Importação</h4>
                    <button
                      onClick={() => setShowGuide(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <i className='bx bx-x'></i>
                    </button>
                  </div>
                  <ImportGuide type={importType} />
                </div>
              )}

              {!showGuide && !file && (
                <button
                  onClick={() => setShowGuide(true)}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <i className='bx bx-help-circle'></i>
                  Ver guia de importação
                </button>
              )}

              {/* AI Categorization Info */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <i className="bx bx-brain text-primary text-xl"></i>
                <div className="text-sm">
                  <p className="font-medium">Categorização Automática</p>
                  <p className="text-muted-foreground">
                    As transações serão categorizadas automaticamente pela IA antes da importação
                  </p>
                </div>
              </div>

              {/* Progress Display */}
              {progress.status !== 'idle' && (
                <div className="p-4 rounded-lg bg-muted/50">
                  {(progress.status === 'uploading' || progress.status === 'processing') && (
                    <div className="flex items-center gap-3">
                      <i className='bx bx-loader-alt bx-spin text-primary text-xl'></i>
                      <span>{progress.message}</span>
                    </div>
                  )}
                  {progress.status === 'error' && (
                    <div className="flex items-center gap-2 text-negative">
                      <i className='bx bx-error-circle text-xl'></i>
                      <span>{progress.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="shrink-0">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button
                onClick={handlePreview}
                disabled={loading || (importType !== 'openfinance' && !file)}
              >
                {loading ? 'Processando...' : 'Continuar'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'preview' && (
          <>
            <div className="flex items-center justify-between py-2 border-b shrink-0">
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
                onClick={() => categorizeWithAI(transactions)}
                disabled={categorizing || transactions.length === 0}
              >
                {categorizing ? (
                  <i className="bx bx-loader-alt bx-spin mr-2"></i>
                ) : (
                  <i className="bx bx-brain mr-2"></i>
                )}
                Recategorizar com IA
              </Button>
            </div>

            <div className="flex-1 overflow-hidden min-h-0 border rounded-md">
              {/* Header */}
              <div className="grid grid-cols-[40px_100px_1fr_100px_180px] gap-2 p-2 text-xs text-muted-foreground border-b bg-background sticky top-0 z-10">
                <div></div>
                <div>Data</div>
                <div>Descrição</div>
                <div className="text-right">Valor</div>
                <div>Categoria</div>
              </div>
              
              {/* Paginated List */}
              <div className="max-h-[400px] overflow-y-auto">
                {paginatedTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="grid grid-cols-[40px_100px_1fr_100px_180px] gap-2 p-2 text-sm border-b hover:bg-muted/50 items-center"
                  >
                    <div>
                      <Checkbox
                        checked={tx.selected}
                        onCheckedChange={(checked) =>
                          handleSelectTransaction(tx.id, !!checked)
                        }
                      />
                    </div>
                    <div className="text-xs">
                      {formatDate(tx.date)}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate" title={tx.description}>
                        {tx.description}
                      </span>
                      {tx.ai_suggested && getConfidenceBadge(tx.ai_confidence)}
                    </div>
                    <div className={`text-right font-medium text-xs ${
                      tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrencyValue(tx.amount)}
                    </div>
                    <div>
                      <Select
                        value={tx.category_id || ''}
                        onValueChange={(value) => handleCategoryChange(tx.id, value)}
                      >
                        <SelectTrigger className="h-7 text-xs">
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
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between py-2 border-t shrink-0">
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="text-sm text-muted-foreground pt-2 border-t shrink-0">
              Transações sem categoria serão importadas como "Outros"
            </div>

            <DialogFooter className="shrink-0">
              <Button variant="outline" onClick={handleBack} disabled={loading}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={selectedCount === 0 || loading}>
                {loading ? 'Importando...' : `Importar (${selectedCount})`}
              </Button>
            </DialogFooter>
          </>
        )}

        {(step === 'importing' || step === 'completed') && (
          <>
            <div className="flex-1 flex items-center justify-center py-12 min-h-0">
              {progress.status === 'processing' && (
                <div className="text-center">
                  <i className="bx bx-loader-alt bx-spin text-4xl text-primary"></i>
                  <p className="mt-2 text-muted-foreground">{progress.message}</p>
                </div>
              )}
              {progress.status === 'completed' && progress.result && (
                <div className="text-center space-y-4">
                  <i className="bx bx-check-circle text-4xl text-positive"></i>
                  <div>
                    <p className="font-medium text-lg">{progress.message}</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <p className="text-positive">
                        <i className='bx bx-check mr-1'></i>
                        {progress.result.imported} transações importadas
                      </p>
                      {progress.result.skipped > 0 && (
                        <p className="text-yellow-500">
                          <i className='bx bx-skip-next mr-1'></i>
                          {progress.result.skipped} ignoradas (duplicadas)
                        </p>
                      )}
                      {progress.result.errors.length > 0 && (
                        <p className="text-negative">
                          <i className='bx bx-error mr-1'></i>
                          {progress.result.errors.length} erros
                        </p>
                      )}
                      {progress.result.errors.length > 0 && (
                        <div className="text-negative text-xs space-y-1">
                          {progress.result.errors.slice(0, 3).map((error, index) => (
                            <p key={`${error}-${index}`}>{error}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {progress.status === 'error' && (
                <div className="text-center">
                  <i className="bx bx-error-circle text-4xl text-negative"></i>
                  <p className="mt-2 text-negative">{progress.message}</p>
                </div>
              )}
            </div>

            <DialogFooter className="shrink-0">
              <Button onClick={handleClose}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
