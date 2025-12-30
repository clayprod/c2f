'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import ImportGuide from './ImportGuide';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  accounts: Array<{ id: string; name: string }>;
}

type ImportType = 'csv' | 'ofx';

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
  const [showGuide, setShowGuide] = useState(true);
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

  const acceptedTypes = importType === 'csv'
    ? '.csv,text/csv'
    : '.ofx,.qfx,application/x-ofx';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const fileName = selectedFile.name.toLowerCase();
    const isValid = importType === 'csv'
      ? fileName.endsWith('.csv')
      : fileName.endsWith('.ofx') || fileName.endsWith('.qfx');

    if (!isValid) {
      toast({
        title: 'Erro',
        description: `Por favor, selecione um arquivo ${importType.toUpperCase()} válido`,
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setProgress({ status: 'idle' });
    setShowGuide(false);
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione um arquivo',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      setProgress({ status: 'uploading', message: 'Lendo arquivo...' });

      // Read file content
      const fileContent = await file.text();

      setProgress({ status: 'processing', message: 'Processando transações...' });

      // Call appropriate import API
      const endpoint = importType === 'csv' ? '/api/import/csv' : '/api/import/ofx';
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
        throw new Error(data.error || `Erro ao importar ${importType.toUpperCase()}`);
      }

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
        title: 'Erro',
        description: error.message || `Erro ao importar ${importType.toUpperCase()}`,
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
    onOpenChange(false);
  };

  const handleTypeChange = (type: ImportType) => {
    setImportType(type);
    setFile(null);
    setProgress({ status: 'idle' });
    setShowGuide(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Transações</DialogTitle>
          <DialogDescription>
            Importe transações de arquivos CSV ou OFX (extrato bancário)
          </DialogDescription>
        </DialogHeader>

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

          {/* Import Guide (collapsible) */}
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

          {/* Progress/Result Display */}
          {progress.status !== 'idle' && (
            <div className="p-4 rounded-lg bg-muted/50">
              {progress.status === 'uploading' || progress.status === 'processing' ? (
                <div className="flex items-center gap-3">
                  <i className='bx bx-loader-alt bx-spin text-primary text-xl'></i>
                  <span>{progress.message}</span>
                </div>
              ) : progress.status === 'completed' && progress.result ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-500">
                    <i className='bx bx-check-circle text-xl'></i>
                    <span className="font-medium">{progress.message}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>Total de linhas: {progress.result.totalRows}</p>
                    <p className="text-green-500">
                      <i className='bx bx-check mr-1'></i>
                      Importadas: {progress.result.imported}
                    </p>
                    <p className="text-yellow-500">
                      <i className='bx bx-skip-next mr-1'></i>
                      Ignoradas (duplicadas): {progress.result.skipped}
                    </p>
                    {progress.result.errors.length > 0 && (
                      <div>
                        <p className="text-red-500 font-medium">Erros:</p>
                        <ul className="list-disc list-inside text-red-500">
                          {progress.result.errors.slice(0, 5).map((error, i) => (
                            <li key={i} className="text-xs">{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : progress.status === 'error' ? (
                <div className="flex items-center gap-2 text-red-500">
                  <i className='bx bx-error-circle text-xl'></i>
                  <span>{progress.message}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            {progress.status === 'completed' ? 'Fechar' : 'Cancelar'}
          </Button>
          {progress.status !== 'completed' && (
            <Button
              onClick={handleImport}
              disabled={!file || loading}
            >
              {loading ? 'Importando...' : `Importar ${importType.toUpperCase()}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
