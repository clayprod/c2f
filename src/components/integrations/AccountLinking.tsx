'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { formatCurrency, formatCurrencyValue } from '@/lib/utils';
import PluggyImportDialog from './PluggyImportDialog';

interface PluggyAccount {
  id: string;
  pluggy_account_id: string;
  name: string;
  type: string;
  subtype: string;
  balance_cents: number;
  currency: string;
  number: string;
  institution_name: string;
  institution_logo: string | null;
  status?: string;
}

interface InternalAccount {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  currency: string;
  institution: string | null;
}

interface AccountLink {
  id: string;
  linked_at: string;
  pluggy_account: PluggyAccount;
  internal_account: InternalAccount;
}

interface Props {
  onLinkChange?: () => void;
}

export default function AccountLinking({ onLinkChange }: Props) {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [links, setLinks] = useState<AccountLink[]>([]);
  const [unlinkedPluggyAccounts, setUnlinkedPluggyAccounts] = useState<PluggyAccount[]>([]);
  const [availableInternalAccounts, setAvailableInternalAccounts] = useState<InternalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [selectedPluggyAccount, setSelectedPluggyAccount] = useState<string>('');
  const [selectedInternalAccount, setSelectedInternalAccount] = useState<string>('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLinkId, setImportLinkId] = useState<string>('');
  const [reconciliation, setReconciliation] = useState<Record<string, { unimported_count: number }>>({});

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/pluggy/links');
      const data = await res.json();
      setLinks(data.data || []);
    } catch (error) {
      console.error('Error fetching links:', error);
    }
  }, []);

  const fetchUnlinkedAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/pluggy/unlinked-accounts');
      const data = await res.json();
      setUnlinkedPluggyAccounts(data.pluggy_accounts || []);
      setAvailableInternalAccounts(data.internal_accounts || []);
    } catch (error) {
      console.error('Error fetching unlinked accounts:', error);
    }
  }, []);

  const fetchReconciliation = useCallback(async () => {
    try {
      const res = await fetch('/api/pluggy/reconcile');
      const data = await res.json();
      const reconcileMap: Record<string, { unimported_count: number }> = {};
      (data.links || []).forEach((link: any) => {
        reconcileMap[link.link_id] = { unimported_count: link.unimported_count };
      });
      setReconciliation(reconcileMap);
    } catch (error) {
      console.error('Error fetching reconciliation:', error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchLinks(), fetchUnlinkedAccounts(), fetchReconciliation()]);
    setLoading(false);
  }, [fetchLinks, fetchUnlinkedAccounts, fetchReconciliation]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleLink = async () => {
    if (!selectedPluggyAccount || !selectedInternalAccount) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Selecione ambas as contas para vincular',
      });
      return;
    }

    setLinking(true);
    try {
      const res = await fetch('/api/pluggy/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluggy_account_id: selectedPluggyAccount,
          internal_account_id: selectedInternalAccount,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao vincular contas');
      }

      toast({
        title: 'Sucesso',
        description: 'Contas vinculadas com sucesso',
      });

      setSelectedPluggyAccount('');
      setSelectedInternalAccount('');
      await fetchAll();
      onLinkChange?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (linkId: string) => {
    const confirmed = await confirm({
      title: 'Desvincular Contas',
      description: 'Tem certeza que deseja desvincular estas contas? As transações importadas não serão afetadas.',
      confirmText: 'Desvincular',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/pluggy/links?id=${linkId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao desvincular');
      }

      toast({
        title: 'Sucesso',
        description: 'Contas desvinculadas com sucesso',
      });

      await fetchAll();
      onLinkChange?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    }
  };

  const getBalanceDifference = (link: AccountLink) => {
    // pluggy_account.balance_cents está em centavos, internal_account.current_balance está em reais
    const pluggyBalanceReais = link.pluggy_account.balance_cents / 100;
    const internalBalance = link.internal_account.current_balance;
    return pluggyBalanceReais - internalBalance;
  };

  const formatAccountType = (type: string) => {
    const types: Record<string, string> = {
      BANK: 'Conta Bancaria',
      CREDIT: 'Cartão de crédito',
      checking: 'Conta Corrente',
      savings: 'Poupanca',
      credit_card: 'Cartão de crédito',
      credit: 'Cartão de crédito',
      investment: 'Investimento',
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Link New Accounts */}
      {unlinkedPluggyAccounts.length > 0 && availableInternalAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <i className="bx bx-link text-primary text-xl"></i>
              Vincular Contas
            </CardTitle>
            <CardDescription>
              Vincule contas do Open Finance com suas contas cadastradas para reconciliacao automatica
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-2 block">Conta/Cartão Open Finance</label>
                <Select value={selectedPluggyAccount} onValueChange={setSelectedPluggyAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta ou cartão" />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinkedPluggyAccounts.map((acc) => {
                      const isCreditCard = acc.type === 'CREDIT' || acc.subtype === 'credit_card';
                      return (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center gap-2">
                            <span>
                              {isCreditCard ? 'Cartão de crédito: ' : ''}
                              {acc.institution_name} - {acc.name}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              ({formatCurrency(acc.balance_cents)})
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Conta/Cartão c2Finance</label>
                <Select value={selectedInternalAccount} onValueChange={setSelectedInternalAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta ou cartão" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInternalAccounts.map((acc) => {
                      const isCreditCard = acc.type === 'credit' || acc.type === 'credit_card';
                      return (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center gap-2">
                            <span>
                              {isCreditCard ? 'Cartão de crédito: ' : ''}
                              {acc.name}
                              {acc.institution ? ` - ${acc.institution}` : ''}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              ({formatCurrencyValue(acc.current_balance)})
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleLink}
                disabled={linking || !selectedPluggyAccount || !selectedInternalAccount}
              >
                {linking ? (
                  <i className="bx bx-loader-alt bx-spin mr-2"></i>
                ) : (
                  <i className="bx bx-link mr-2"></i>
                )}
                Vincular Contas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <i className="bx bx-check-circle text-green-500 text-xl"></i>
            Contas Vinculadas
          </CardTitle>
          <CardDescription>
            Contas do Open Finance vinculadas com suas contas c2Finance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <i className="bx bx-link-alt text-4xl mb-2"></i>
              <p>Nenhuma conta vinculada ainda</p>
              <p className="text-sm">Vincule suas contas para comparar saldos e importar transações</p>
            </div>
          ) : (
            <div className="space-y-4">
              {links.map((link) => {
                const diff = getBalanceDifference(link);
                const hasDivergence = Math.abs(diff) > 0.01;

                return (
                  <div
                    key={link.id}
                    className={`p-4 rounded-lg border ${
                      hasDivergence ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 min-w-0">
                        {/* Pluggy Account */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            {link.pluggy_account.institution_logo ? (
                              <img
                                src={link.pluggy_account.institution_logo}
                                alt=""
                                className="w-6 h-6 object-contain"
                              />
                            ) : (
                              <i className="bx bx-bank text-xl text-muted-foreground"></i>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm break-words">
                              {(link.pluggy_account.type === 'CREDIT' || link.pluggy_account.subtype === 'credit_card') 
                                ? `Cartão de crédito: ${link.pluggy_account.name}` 
                                : link.pluggy_account.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {link.pluggy_account.institution_name}
                            </p>
                            <p className="text-sm font-semibold">
                              {formatCurrency(link.pluggy_account.balance_cents)}
                            </p>
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="hidden sm:flex px-4">
                          <i className="bx bx-link-alt text-2xl text-muted-foreground"></i>
                        </div>

                        {/* Internal Account */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <i className="bx bx-wallet text-xl text-primary"></i>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm break-words">
                              {(link.internal_account.type === 'credit' || link.internal_account.type === 'credit_card')
                                ? `Cartão de crédito: ${link.internal_account.name}` 
                                : link.internal_account.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatAccountType(link.internal_account.type)}
                            </p>
                            <p className="text-sm font-semibold">
                              {formatCurrencyValue(link.internal_account.current_balance)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 w-full sm:w-auto sm:justify-end">
                        {/* Unimported transactions */}
                        {reconciliation[link.id]?.unimported_count > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setImportLinkId(link.id);
                              setImportDialogOpen(true);
                            }}
                            className="text-primary w-full sm:w-auto"
                          >
                            <i className="bx bx-file-plus mr-1"></i>
                            {reconciliation[link.id].unimported_count} pendente(s)
                          </Button>
                        )}

                        {/* Divergence Alert */}
                        {hasDivergence && (
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-yellow-600 font-medium">Divergencia</p>
                            <p className={`text-sm font-bold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {diff > 0 ? '+' : ''}{formatCurrencyValue(diff)}
                            </p>
                          </div>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlink(link.id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          <i className="bx bx-unlink"></i>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unlinked Pluggy Accounts */}
      {unlinkedPluggyAccounts.length > 0 && availableInternalAccounts.length === 0 && (
        <Card className="border-yellow-500/20">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <i className="bx bx-info-circle text-xl text-yellow-500"></i>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Contas não vinculadas</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Voce tem {unlinkedPluggyAccounts.length} conta(s) do Open Finance que podem ser vinculadas,
                  mas não há contas disponíveis no c2Finance.
                </p>
                <p className="text-sm text-muted-foreground">
                  Crie novas contas em <a href="/app/accounts" className="text-primary hover:underline">Contas</a> para vincular.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {ConfirmDialog}

      {/* Import Dialog */}
      <PluggyImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        linkId={importLinkId}
        onImportComplete={() => {
          fetchAll();
          onLinkChange?.();
        }}
      />
    </div>
  );
}
