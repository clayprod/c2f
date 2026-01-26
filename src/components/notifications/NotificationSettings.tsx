'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface NotificationRule {
  id?: string;
  user_id?: string | null;
  rule_type: 'debt_due' | 'receivable_due' | 'budget_limit' | 'budget_empty' | 'balance_divergence' | 'daily_spending_exceeded' | 'expenses_above_budget';
  enabled: boolean;
  threshold_days?: number | null;
  threshold_percentage?: number | null;
  frequency_hours: number;
}

const defaultRules: NotificationRule[] = [
  {
    rule_type: 'debt_due',
    enabled: true,
    threshold_days: 7,
    frequency_hours: 24,
  },
  {
    rule_type: 'receivable_due',
    enabled: true,
    threshold_days: 7,
    frequency_hours: 24,
  },
  {
    rule_type: 'budget_limit',
    enabled: true,
    threshold_percentage: 80,
    frequency_hours: 12,
  },
  {
    rule_type: 'budget_empty',
    enabled: true,
    frequency_hours: 48,
  },
  {
    rule_type: 'balance_divergence',
    enabled: true,
    frequency_hours: 24,
  },
  {
    rule_type: 'daily_spending_exceeded',
    enabled: true,
    frequency_hours: 24,
  },
  {
    rule_type: 'expenses_above_budget',
    enabled: true,
    frequency_hours: 24,
  },
];

export function NotificationSettings() {
  const [rules, setRules] = useState<NotificationRule[]>(defaultRules);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/notifications/rules');
      if (!response.ok) throw new Error('Failed to fetch rules');

      const { data } = await response.json();

      // Merge with defaults, prioritizing user-specific rules
      const rulesMap = new Map<string, NotificationRule>();
      defaultRules.forEach((rule) => rulesMap.set(rule.rule_type, { ...rule }));

      data.forEach((rule: NotificationRule) => {
        if (rule.user_id !== null) {
          // User-specific rule
          rulesMap.set(rule.rule_type, rule);
        } else if (!rulesMap.has(rule.rule_type)) {
          // Global rule, only use if no user-specific exists
          rulesMap.set(rule.rule_type, rule);
        }
      });

      setRules(Array.from(rulesMap.values()));
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as configurações de notificações.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRule = async (ruleType: string, updates: Partial<NotificationRule>) => {
    setSaving(true);
    try {
      const rule = rules.find((r) => r.rule_type === ruleType);
      if (!rule) return;

      const updatedRule = { ...rule, ...updates };

      const response = await fetch('/api/notifications/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRule),
      });

      if (!response.ok) throw new Error('Failed to save rule');

      setRules((prev) =>
        prev.map((r) => (r.rule_type === ruleType ? updatedRule : r))
      );

      toast({
        title: 'Sucesso',
        description: 'Configuração salva com sucesso.',
      });
    } catch (error) {
      console.error('Error updating rule:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a configuração.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getRuleLabel = (ruleType: string): string => {
    const labels: Record<string, string> = {
      debt_due: 'Vencimentos de Dívidas',
      receivable_due: 'Vencimentos de Recebíveis',
      budget_limit: 'Limites de Orçamento',
      budget_empty: 'Orçamentos Não Preenchidos',
      balance_divergence: 'Divergência de Saldo (Open Finance)',
      daily_spending_exceeded: 'Gasto Diário Acima do Permitido',
      expenses_above_budget: 'Despesas Acima do Orçamento',
    };
    return labels[ruleType] || ruleType;
  };

  const getRuleDescription = (ruleType: string): string => {
    const descriptions: Record<string, string> = {
      debt_due: 'Receba alertas quando suas dívidas estiverem próximas do vencimento',
      receivable_due: 'Receba alertas quando seus recebíveis estiverem próximos do vencimento',
      budget_limit: 'Receba alertas quando seus orçamentos estiverem próximos do limite',
      budget_empty: 'Receba alertas quando você não tiver definido orçamentos para categorias',
      balance_divergence: 'Receba alertas quando houver divergência entre o saldo das contas vinculadas no Open Finance e o saldo interno',
      daily_spending_exceeded: 'Receba alertas quando sua média de gasto diário estiver acima do permitido para o restante do mês',
      expenses_above_budget: 'Receba alertas quando suas despesas ultrapassarem o valor orçado para alguma categoria',
    };
    return descriptions[ruleType] || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <i className="bx bx-loader-alt bx-spin text-2xl text-muted-foreground"></i>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configurações de Notificações</h2>
        <p className="text-muted-foreground">
          Configure quando e como você deseja receber notificações sobre suas finanças.
        </p>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => (
          <Card key={rule.rule_type}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{getRuleLabel(rule.rule_type)}</CardTitle>
                  <CardDescription>{getRuleDescription(rule.rule_type)}</CardDescription>
                </div>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(checked) =>
                    updateRule(rule.rule_type, { enabled: checked })
                  }
                  disabled={saving}
                />
              </div>
            </CardHeader>
            {rule.enabled && (
              <CardContent className="space-y-4">
                {(rule.rule_type === 'debt_due' || rule.rule_type === 'receivable_due') && (
                  <div className="space-y-2">
                    <Label htmlFor={`${rule.rule_type}-days`}>
                      Alertar quantos dias antes do vencimento?
                    </Label>
                    <Input
                      id={`${rule.rule_type}-days`}
                      type="number"
                      min="1"
                      value={rule.threshold_days || ''}
                      onChange={(e) =>
                        updateRule(rule.rule_type, {
                          threshold_days: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      disabled={saving}
                    />
                  </div>
                )}

                {rule.rule_type === 'budget_limit' && (
                  <div className="space-y-2">
                    <Label htmlFor={`${rule.rule_type}-percentage`}>
                      Alertar quando atingir quantos % do limite?
                    </Label>
                    <Input
                      id={`${rule.rule_type}-percentage`}
                      type="number"
                      min="0"
                      max="100"
                      value={rule.threshold_percentage || ''}
                      onChange={(e) =>
                        updateRule(rule.rule_type, {
                          threshold_percentage: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
                        })
                      }
                      disabled={saving}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor={`${rule.rule_type}-frequency`}>
                    Frequência mínima entre notificações (horas)
                  </Label>
                  <Input
                    id={`${rule.rule_type}-frequency`}
                    type="number"
                    min="1"
                    value={rule.frequency_hours}
                    onChange={(e) =>
                      updateRule(rule.rule_type, {
                        frequency_hours: parseInt(e.target.value) || 24,
                      })
                    }
                    disabled={saving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Evita spam de notificações do mesmo tipo
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
