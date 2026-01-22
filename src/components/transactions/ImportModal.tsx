'use client';

import { useState, useEffect } from 'react';
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
import { formatCurrency, formatDate } from '@/lib/utils';

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
  selected: boolean;
  category_id: string | null;
  ai_suggested: boolean;
  ai_confidence?: 'low' | 'medium' | 'high';
}

type ImportType = 'csv' | 'ofx';
type ImportStep = 'upload' | 'preview' | 'importing' | 'completed';

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

  // Fetch categories when modal opens
  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

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

      setProgress({ status: 'processing', message: 'Analisando transações...' });

      // Call preview API
      const endpoint = importType === 'csv' ? '/api/import/csv/preview' : '/api/import/ofx/preview';
      const bodyKey = importType === 'csv' ? 'csv_content' : 'ofx_content';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [bodyKey]: fileContent,
          account_id: selectedAccountId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erro ao processar ${importType.toUpperCase()}`);
      }

      // Convert to ParsedTransaction format
      const parsedTransactions: ParsedTransaction[] = (data.transactions || []).map(
        (tx: any, index: number) => ({
          id: tx.id || `tx-${index}`,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          selected: true,
          category_id: null,
          ai_suggested: false,
        })
      );

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

  const categorizeWithAI = async (txs: ParsedTransaction[]) => {
    setCategorizing(true);
    try {
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: txs.map(tx => ({
            id: tx.id,
            description: tx.description,
            amount: tx.amount,
            date: tx.date,
          })),
        }),
      });

      if (!res.ok) {
        console.warn('AI categorization failed');
        return;
      }

      const data = await res.json();

      // Create a map of category name to ID
      const categoryNameMap = new Map(
        categories.map(c => [c.name.toLowerCase(), c.id])
      );

      // Create a map of transaction ID to categorization
      const categorizationMap = new Map(
        (data.transactions || []).map((cat: any) => [cat.id, cat])
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
        title: 'Categorização automática',
        description: 'Transações categorizadas pela IA. Você pode ajustar antes de importar.',
      });
    } catch (error: any) {
      console.error('Error categorizing:', error);
    } finally {
      setCategorizing(false);
    }
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

    try {
      setLoading(true);
      setStep('importing');
      setProgress({ status: 'processing', message: 'Importando transações...' });

      const fileContent = await file!.text();

      // Call import API with categories
      const endpoint = importType === 'csv' ? '/api/import/csv' : '/api/import/ofx';
      const bodyKey = importType === 'csv' ? 'csv_content' : 'ofx_content';

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

  const handleClose = () => {
    setFile(null);
    setSelectedAccountId('');
    setProgress({ status: 'idle' });
    setShowGuide(true);
    setStep('upload');
    setTransactions([]);
    setSelectAll(true);
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

  const selectedCount = transactions.filter(tx => tx.selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Transações</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Importe transações de arquivos CSV ou OFX (extrato bancário)'}
            {step === 'preview' && 'Revise e categorize as transações antes de importar'}
            {step === 'importing' && 'Importando transações...'}
            {step === 'completed' && 'Importação finalizada'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <>
            {/* Import Type Tabs */}
            <div className="flex border-b border-border">
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
            </div>

            <div className="space-y-4">
              {/* Account Selection */}
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

              {/* File Input */}
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
                    <i className='bx bx-check-circle text-green-500'></i>
                    Arquivo selecionado: {file.name}
                  </p>
                )}
              </div>

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
                    <div className="flex items-center gap-2 text-red-500">
                      <i className='bx bx-error-circle text-xl'></i>
                      <span>{progress.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handlePreview} disabled={!file || loading}>
                {loading ? 'Processando...' : 'Continuar'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'preview' && (
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

            <div className="flex-1 overflow-auto min-h-[300px]">
              <table className="w-full">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="p-2 w-10"></th>
                    <th className="p-2">Data</th>
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
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]" title={tx.description}>
                            {tx.description}
                          </span>
                          {tx.ai_suggested && getConfidenceBadge(tx.ai_confidence)}
                        </div>
                      </td>
                      <td className={`p-2 text-sm text-right font-medium ${
                        tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(tx.amount)}
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

            <div className="text-sm text-muted-foreground pt-2 border-t">
              Transações sem categoria serão importadas como "Outros"
            </div>

            <DialogFooter>
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
            <div className="flex-1 flex items-center justify-center py-12">
              {progress.status === 'processing' && (
                <div className="text-center">
                  <i className="bx bx-loader-alt bx-spin text-4xl text-primary"></i>
                  <p className="mt-2 text-muted-foreground">{progress.message}</p>
                </div>
              )}
              {progress.status === 'completed' && progress.result && (
                <div className="text-center space-y-4">
                  <i className="bx bx-check-circle text-4xl text-green-500"></i>
                  <div>
                    <p className="font-medium text-lg">{progress.message}</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <p className="text-green-500">
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
                        <p className="text-red-500">
                          <i className='bx bx-error mr-1'></i>
                          {progress.result.errors.length} erros
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {progress.status === 'error' && (
                <div className="text-center">
                  <i className="bx bx-error-circle text-4xl text-red-500"></i>
                  <p className="mt-2 text-red-500">{progress.message}</p>
                </div>
              )}
            </div>

            <DialogFooter>
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
