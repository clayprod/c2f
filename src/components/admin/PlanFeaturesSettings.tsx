'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { PlanFeatures, PlanDisplayConfig, PlanFeature } from '@/services/admin/globalSettings';
import {
  PLAN_MODULES,
  buildPlanFeatureListSync,
  buildPlanFeatureListWithInheritanceSync,
  formatFeatureTextSync,
} from '@/lib/planFeatures';

interface PlanFeaturesData {
  plan_features_free?: PlanFeatures;
  plan_features_pro?: PlanFeatures;
  plan_features_premium?: PlanFeatures;
  plan_display_config?: PlanDisplayConfig;
}

const LIMIT_CONFIG = [
  { id: 'transactions', label: 'Transações/mês' },
  { id: 'ai_advisor', label: 'Chats com AI Advisor/mês' },
];

const DEFAULT_FEATURES: Record<'free' | 'pro' | 'premium', PlanFeatures> = {
  free: {
    dashboard: { enabled: true },
    transactions: { enabled: true, limit: 100 },
    accounts: { enabled: true },
    credit_cards: { enabled: true },
    categories: { enabled: true },
    budgets: { enabled: false },
    debts: { enabled: false },
    receivables: { enabled: false },
    investments: { enabled: false },
    assets: { enabled: false },
    goals: { enabled: false },
    reports: { enabled: false },
    integrations: { enabled: false },
    ai_advisor: { enabled: false, limit: 10 },
  },
  pro: {
    dashboard: { enabled: true },
    transactions: { enabled: true, unlimited: true },
    accounts: { enabled: true },
    credit_cards: { enabled: true },
    categories: { enabled: true },
    budgets: { enabled: true },
    debts: { enabled: true },
    receivables: { enabled: true },
    investments: { enabled: true },
    assets: { enabled: true },
    goals: { enabled: true },
    reports: { enabled: false },
    integrations: { enabled: false },
    ai_advisor: { enabled: true, limit: 10 },
  },
  premium: {
    dashboard: { enabled: true },
    transactions: { enabled: true, unlimited: true },
    accounts: { enabled: true },
    credit_cards: { enabled: true },
    categories: { enabled: true },
    budgets: { enabled: true },
    debts: { enabled: true },
    receivables: { enabled: true },
    investments: { enabled: true },
    assets: { enabled: true },
    goals: { enabled: true },
    reports: { enabled: true },
    integrations: { enabled: true },
    ai_advisor: { enabled: true, limit: 100 },
  },
};

export default function PlanFeaturesSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'free' | 'pro' | 'premium' | 'display'>('free');
  const [features, setFeatures] = useState<PlanFeaturesData>({});
  const [displayConfig, setDisplayConfig] = useState<PlanDisplayConfig>({});

  const parseLegacyLimit = (text?: string): number | undefined => {
    if (!text) return undefined;
    const match = text.match(/(\d+)/);
    if (!match) return undefined;
    const value = parseInt(match[1], 10);
    return Number.isNaN(value) ? undefined : value;
  };

  const normalizePlanFeatures = (raw: PlanFeatures | undefined, defaults: PlanFeatures): PlanFeatures => {
    // If we have raw data from database, use it as-is and only handle legacy formats
    if (raw && Object.keys(raw).length > 0) {
      const normalized: PlanFeatures = { ...raw };

      // Handle legacy format: transactions_unlimited and transactions_limit
      // These are old format fields that need to be converted to the new transactions format
      if (raw.transactions_unlimited?.enabled && !normalized.transactions) {
        normalized.transactions = {
          enabled: true,
          unlimited: true,
          limit: undefined,
        } as PlanFeature;
      } else if (raw.transactions_limit?.enabled && !normalized.transactions) {
        const legacyLimit = parseLegacyLimit(raw.transactions_limit.text);
        normalized.transactions = {
          enabled: true,
          unlimited: false,
          limit: legacyLimit ?? 100,
        } as PlanFeature;
      }

      // Handle legacy format: ai_advisor with text field
      if (raw.ai_advisor?.text && typeof raw.ai_advisor.limit !== 'number') {
        const legacyAdvisorLimit = parseLegacyLimit(raw.ai_advisor.text);
        if (legacyAdvisorLimit !== undefined) {
          normalized.ai_advisor = {
            ...(normalized.ai_advisor || {}),
            enabled: normalized.ai_advisor?.enabled ?? raw.ai_advisor.enabled ?? false,
            limit: legacyAdvisorLimit,
          } as PlanFeature;
        }
      }

      // Only add defaults for keys that don't exist in raw data at all
      // This preserves ALL values that were saved to the database
      Object.entries(defaults).forEach(([key, defaultValue]) => {
        // Only add if the key doesn't exist - don't merge or override
        if (!(key in normalized)) {
          normalized[key] = defaultValue;
        }
      });

      return normalized;
    }

    // If no raw data, return defaults
    return { ...defaults };
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/plan-features');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      
      console.log('[PlanFeaturesSettings] Raw data from API:', JSON.stringify(data, null, 2));
      
      const normalizedFree = normalizePlanFeatures(data.plan_features_free, DEFAULT_FEATURES.free);
      const normalizedPro = normalizePlanFeatures(data.plan_features_pro, DEFAULT_FEATURES.pro);
      const normalizedPremium = normalizePlanFeatures(data.plan_features_premium, DEFAULT_FEATURES.premium);
      
      console.log('[PlanFeaturesSettings] Normalized free:', JSON.stringify(normalizedFree, null, 2));
      console.log('[PlanFeaturesSettings] Normalized pro:', JSON.stringify(normalizedPro, null, 2));
      console.log('[PlanFeaturesSettings] Normalized premium:', JSON.stringify(normalizedPremium, null, 2));
      
      setFeatures({
        plan_features_free: normalizedFree,
        plan_features_pro: normalizedPro,
        plan_features_premium: normalizedPremium,
      });
      setDisplayConfig(data.plan_display_config || {});
    } catch (error) {
      console.error('Error fetching plan features:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as configurações',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...features,
        plan_display_config: displayConfig,
      };
      
      console.log('[PlanFeaturesSettings] Saving payload:', JSON.stringify(payload, null, 2));
      
      const res = await fetch('/api/admin/plan-features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('[PlanFeaturesSettings] Save error response:', errorData);
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const responseData = await res.json();
      console.log('[PlanFeaturesSettings] Save success response:', responseData);

      toast({
        title: 'Sucesso',
        description: 'Configurações salvas com sucesso. A landing page será atualizada em até 5 minutos.',
      });

      // Clear cache (try to clear, but don't fail if it doesn't work)
      try {
        await fetch('/api/public/pricing', { method: 'POST' });
      } catch (error) {
        console.warn('Failed to clear pricing cache:', error);
      }
      
      await fetchSettings();
      updateEnabledFeatures();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as configurações',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateFeature = (
    plan: 'free' | 'pro' | 'premium',
    featureId: string,
    updates: Partial<PlanFeature>
  ) => {
    const planKey = `plan_features_${plan}` as keyof PlanFeaturesData;
    const currentFeatures = (features[planKey] as PlanFeatures) || {};
    
    setFeatures({
      ...features,
      [planKey]: {
        ...currentFeatures,
        [featureId]: {
          ...(currentFeatures[featureId] || { enabled: false }),
          ...updates,
        } as PlanFeature,
      },
    });
  };

  const getCurrentPlanFeatures = (plan: 'free' | 'pro' | 'premium'): PlanFeatures => {
    const planKey = `plan_features_${plan}` as keyof PlanFeaturesData;
    return (features[planKey] as PlanFeatures) || DEFAULT_FEATURES[plan];
  };

  const [enabledFeatures, setEnabledFeatures] = useState<{
    free: Array<{ id: string; text: string; enabled: boolean }>;
    pro: Array<{ id: string; text: string; enabled: boolean }>;
    premium: Array<{ id: string; text: string; enabled: boolean }>;
  }>({
    free: [],
    pro: [],
    premium: [],
  });

  const updateEnabledFeatures = () => {
    const freeFeatures = buildPlanFeatureListSync(getCurrentPlanFeatures('free'));
    const proFeatures = buildPlanFeatureListWithInheritanceSync(
      getCurrentPlanFeatures('pro'),
      getCurrentPlanFeatures('free'),
      'Free'
    );
    const premiumFeatures = buildPlanFeatureListWithInheritanceSync(
      getCurrentPlanFeatures('premium'),
      getCurrentPlanFeatures('pro'),
      'Pro'
    );
    setEnabledFeatures({
      free: freeFeatures,
      pro: proFeatures,
      premium: premiumFeatures,
    });
  };

  useEffect(() => {
    if (!loading) {
      updateEnabledFeatures();
    }
  }, [features, loading]);

  const getEnabledFeatures = (plan: 'free' | 'pro' | 'premium') => {
    return enabledFeatures[plan];
  };

  const renderModuleList = (plan: 'free' | 'pro' | 'premium') => {
    const planFeatures = getCurrentPlanFeatures(plan);
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {PLAN_MODULES.map((module) => {
          const feature = planFeatures[module.id] || { enabled: false };
          return (
            <label
              key={module.id}
              htmlFor={`${plan}-${module.id}-enabled`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent/5"
            >
              <Checkbox
                id={`${plan}-${module.id}-enabled`}
                checked={feature.enabled}
                onCheckedChange={(checked) => updateFeature(plan, module.id, { enabled: checked === true })}
              />
              <div className="flex-1">
                <div className="font-medium text-foreground">{module.label}</div>
                <div className="text-xs text-muted-foreground">{module.route}</div>
              </div>
            </label>
          );
        })}
      </div>
    );
  };

  const renderLimitControls = (plan: 'free' | 'pro' | 'premium') => {
    const planFeatures = getCurrentPlanFeatures(plan);
    return (
      <div className="space-y-4">
        {LIMIT_CONFIG.map((limitItem) => {
          const feature = planFeatures[limitItem.id] || { enabled: false };
          const limitValue = typeof feature.limit === 'number' ? feature.limit : '';
          const isDisabled = !feature.enabled;
          return (
            <div key={limitItem.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{limitItem.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatFeatureTextSync(limitItem.id, feature)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ilimitado</span>
                  <Switch
                    checked={feature.unlimited || false}
                    disabled={isDisabled}
                    onCheckedChange={(checked) =>
                      updateFeature(plan, limitItem.id, {
                        unlimited: checked,
                        limit: checked ? undefined : feature.limit,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor={`${plan}-${limitItem.id}-limit`} className="text-xs text-muted-foreground">
                  Limite
                </Label>
                <Input
                  id={`${plan}-${limitItem.id}-limit`}
                  type="number"
                  min={0}
                  value={feature.unlimited ? '' : limitValue}
                  disabled={feature.unlimited || isDisabled}
                  onChange={(event) => {
                    const parsed = parseInt(event.target.value, 10);
                    updateFeature(plan, limitItem.id, {
                      limit: Number.isNaN(parsed) ? undefined : parsed,
                      unlimited: false,
                    });
                  }}
                  className="h-8 w-32"
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Planos e Features</CardTitle>
          <CardDescription>
            Configure quais features estão disponíveis em cada plano e como eles são exibidos na landing page
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="free">Free</TabsTrigger>
              <TabsTrigger value="pro">Pro</TabsTrigger>
              <TabsTrigger value="premium">Premium</TabsTrigger>
              <TabsTrigger value="display">Exibição</TabsTrigger>
            </TabsList>

            {/* Free Plan Features */}
            <TabsContent value="free" className="mt-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <i className="bx bx-check-square"></i>
                        Modulos liberados
                      </CardTitle>
                      <CardDescription>
                        Ative ou bloqueie cada modulo para este plano.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>{renderModuleList('free')}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <i className="bx bx-slider"></i>
                        Limites
                      </CardTitle>
                      <CardDescription>
                        Defina limites mensais ou deixe ilimitado.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>{renderLimitControls('free')}</CardContent>
                  </Card>
                </div>
                <div>
                  <Card className="sticky top-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <i className="bx bx-show"></i>
                        Preview na Landing Page
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold mb-2">
                        {displayConfig.free?.name || 'Free'}
                      </div>
                      <div className="text-2xl font-bold mb-1">
                        {displayConfig.free?.priceFormatted || 'Grátis'}
                      </div>
                      <div className="text-sm text-muted-foreground mb-4">
                        {displayConfig.free?.description || 'Comece a organizar suas finanças'}
                      </div>
                      <ul className="space-y-2">
                        {getEnabledFeatures('free').map(feature => (
                          <li key={feature.id} className="flex items-start gap-2 text-sm">
                            <i className="bx bx-check text-primary mt-0.5"></i>
                            <span>{feature.text}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Pro Plan Features */}
            <TabsContent value="pro" className="mt-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <i className="bx bx-check-square"></i>
                        Modulos liberados
                      </CardTitle>
                      <CardDescription>
                        Ative ou bloqueie cada modulo para este plano.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>{renderModuleList('pro')}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <i className="bx bx-slider"></i>
                        Limites
                      </CardTitle>
                      <CardDescription>
                        Defina limites mensais ou deixe ilimitado.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>{renderLimitControls('pro')}</CardContent>
                  </Card>
                </div>
                <div>
                  <Card className="sticky top-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <i className="bx bx-show"></i>
                        Preview na Landing Page
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold mb-2">
                        {displayConfig.pro?.name || 'Pro'}
                      </div>
                      <div className="text-2xl font-bold mb-1">
                        R$ <span className="text-muted-foreground text-sm">(do Stripe)</span>
                      </div>
                      <div className="text-sm text-muted-foreground mb-4">
                        {displayConfig.pro?.description || 'O poder da IA para suas finanças'}
                      </div>
                      <ul className="space-y-2">
                        {getEnabledFeatures('pro').map(feature => (
                          <li key={feature.id} className="flex items-start gap-2 text-sm">
                            <i className="bx bx-check text-primary mt-0.5"></i>
                            <span>{feature.text}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Premium Plan Features */}
            <TabsContent value="premium" className="mt-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <i className="bx bx-check-square"></i>
                        Modulos liberados
                      </CardTitle>
                      <CardDescription>
                        Ative ou bloqueie cada modulo para este plano.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>{renderModuleList('premium')}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <i className="bx bx-slider"></i>
                        Limites
                      </CardTitle>
                      <CardDescription>
                        Defina limites mensais ou deixe ilimitado.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>{renderLimitControls('premium')}</CardContent>
                  </Card>
                </div>
                <div>
                  <Card className="sticky top-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <i className="bx bx-show"></i>
                        Preview na Landing Page
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold mb-2">
                        {displayConfig.premium?.name || 'Premium'}
                      </div>
                      <div className="text-2xl font-bold mb-1">
                        R$ <span className="text-muted-foreground text-sm">(do Stripe)</span>
                      </div>
                      <div className="text-sm text-muted-foreground mb-4">
                        {displayConfig.premium?.description || 'Análise avançada e IA ilimitada'}
                      </div>
                      <ul className="space-y-2">
                        {getEnabledFeatures('premium').map(feature => (
                          <li key={feature.id} className="flex items-start gap-2 text-sm">
                            <i className="bx bx-check text-primary mt-0.5"></i>
                            <span>{feature.text}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Display Configuration */}
            <TabsContent value="display" className="space-y-6 mt-6">
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <i className="bx bx-info-circle"></i>
                    Sobre a Configuração de Exibição
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>Configure como cada plano aparece na landing page. Os preços dos planos pagos (Pro e Premium) são obtidos diretamente do Stripe.</p>
                  <p className="mt-2">As features habilitadas em cada aba de plano aparecerão como checkmarks na lista de benefícios.</p>
                </CardContent>
              </Card>
              
              <div className="grid gap-6 md:grid-cols-3">
                {(['free', 'pro', 'premium'] as const).map((plan) => {
                  const planLabels = {
                    free: { name: 'Free', desc: 'Comece a organizar suas finanças', cta: 'Começar agora', period: 'para sempre' },
                    pro: { name: 'Pro', desc: 'O poder da IA para suas finanças', cta: 'Assinar Pro', period: '/mês' },
                    premium: { name: 'Premium', desc: 'Análise avançada e IA ilimitada', cta: 'Assinar Premium', period: '/mês' },
                  };
                  const defaults = planLabels[plan];
                  
                  return (
                    <Card key={plan} className={displayConfig[plan]?.popular ? 'ring-2 ring-primary' : ''}>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
                          <span className="capitalize">{plan}</span>
                          {displayConfig[plan]?.popular && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Popular</span>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {getEnabledFeatures(plan).length} features habilitadas
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor={`${plan}-name`}>Nome do Plano</Label>
                          <Input
                            id={`${plan}-name`}
                            value={displayConfig[plan]?.name || ''}
                            onChange={(e) =>
                              setDisplayConfig({
                                ...displayConfig,
                                [plan]: { ...displayConfig[plan], name: e.target.value },
                              })
                            }
                            placeholder={defaults.name}
                          />
                          <p className="text-xs text-muted-foreground mt-1">Padrão: {defaults.name}</p>
                        </div>
                        <div>
                          <Label htmlFor={`${plan}-description`}>Descrição (subtítulo)</Label>
                          <Input
                            id={`${plan}-description`}
                            value={displayConfig[plan]?.description || ''}
                            onChange={(e) =>
                              setDisplayConfig({
                                ...displayConfig,
                                [plan]: { ...displayConfig[plan], description: e.target.value },
                              })
                            }
                            placeholder={defaults.desc}
                          />
                          <p className="text-xs text-muted-foreground mt-1">Padrão: {defaults.desc}</p>
                        </div>
                        {plan === 'free' ? (
                          <div>
                            <Label htmlFor={`${plan}-priceFormatted`}>Texto do Preço</Label>
                            <Input
                              id={`${plan}-priceFormatted`}
                              value={displayConfig[plan]?.priceFormatted || ''}
                              onChange={(e) =>
                                setDisplayConfig({
                                  ...displayConfig,
                                  [plan]: { ...displayConfig[plan], priceFormatted: e.target.value },
                                })
                              }
                              placeholder="Grátis"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Padrão: Grátis</p>
                          </div>
                        ) : (
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <Label className="text-muted-foreground">Preço</Label>
                            <p className="text-sm">Obtido automaticamente do Stripe</p>
                          </div>
                        )}
                        <div>
                          <Label htmlFor={`${plan}-period`}>Período</Label>
                          <Input
                            id={`${plan}-period`}
                            value={displayConfig[plan]?.period || ''}
                            onChange={(e) =>
                              setDisplayConfig({
                                ...displayConfig,
                                [plan]: { ...displayConfig[plan], period: e.target.value },
                              })
                            }
                            placeholder={defaults.period}
                          />
                          <p className="text-xs text-muted-foreground mt-1">Padrão: {defaults.period}</p>
                        </div>
                        <div>
                          <Label htmlFor={`${plan}-cta`}>Texto do Botão (CTA)</Label>
                          <Input
                            id={`${plan}-cta`}
                            value={displayConfig[plan]?.cta || ''}
                            onChange={(e) =>
                              setDisplayConfig({
                                ...displayConfig,
                                [plan]: { ...displayConfig[plan], cta: e.target.value },
                              })
                            }
                            placeholder={defaults.cta}
                          />
                          <p className="text-xs text-muted-foreground mt-1">Padrão: {defaults.cta}</p>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-accent/5">
                          <div>
                            <Label htmlFor={`${plan}-popular`}>Destacar como Popular</Label>
                            <p className="text-xs text-muted-foreground">Mostra badge "Mais popular"</p>
                          </div>
                          <Switch
                            id={`${plan}-popular`}
                            checked={displayConfig[plan]?.popular || false}
                            onCheckedChange={(checked) =>
                              setDisplayConfig({
                                ...displayConfig,
                                [plan]: { ...displayConfig[plan], popular: checked },
                              })
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
