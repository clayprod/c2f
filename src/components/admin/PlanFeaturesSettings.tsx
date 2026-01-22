'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { PlanFeatures, PlanDisplayConfig } from '@/services/admin/globalSettings';

interface PlanFeaturesData {
  plan_features_free?: PlanFeatures;
  plan_features_pro?: PlanFeatures;
  plan_features_premium?: PlanFeatures;
  plan_display_config?: PlanDisplayConfig;
}

// Feature categories for better organization
const FEATURE_CATEGORIES: Record<string, { label: string; icon: string; features: string[] }> = {
  basic: {
    label: 'Recursos Básicos',
    icon: 'bx-layer',
    features: ['transactions_limit', 'transactions_unlimited', 'csv_import', 'ofx_import'],
  },
  panels: {
    label: 'Painéis do App',
    icon: 'bx-grid-alt',
    features: ['budgets', 'investments', 'goals', 'reports'],
  },
  ai: {
    label: 'Inteligência Artificial',
    icon: 'bx-brain',
    features: ['ai_advisor', 'ai_categorization', 'predictive_analysis'],
  },
  integrations: {
    label: 'Integrações',
    icon: 'bx-plug',
    features: ['pluggy_integration', 'whatsapp_integration'],
  },
  support: {
    label: 'Suporte',
    icon: 'bx-support',
    features: ['priority_support'],
  },
};

// Map features to app panels for description
const FEATURE_PANEL_MAP: Record<string, string> = {
  budgets: '/app/budgets - Orçamentos',
  investments: '/app/investments - Investimentos',
  goals: '/app/goals - Objetivos',
  reports: '/app/reports - Relatórios',
  ai_advisor: '/app/advisor - AI Advisor',
  pluggy_integration: '/app/integrations - Open Finance (Admin)',
  whatsapp_integration: '/app/integrations - WhatsApp',
};

const DEFAULT_FEATURES: Record<'free' | 'pro' | 'premium', PlanFeatures> = {
  free: {
    transactions_limit: { enabled: true, text: 'Até 100 transações/mês' },
    csv_import: { enabled: true, text: 'Importação CSV' },
    ofx_import: { enabled: false, text: 'Importação OFX' },
    ai_advisor: { enabled: false, text: 'AI Advisor' },
    budgets: { enabled: false, text: 'Orçamentos e Projeções' },
    investments: { enabled: false, text: 'Investimentos e Dívidas' },
    goals: { enabled: false, text: 'Patrimônio e Objetivos' },
    pluggy_integration: { enabled: false, text: 'Integração Bancária (Open Finance)' },
    whatsapp_integration: { enabled: false, text: 'Integração WhatsApp' },
    reports: { enabled: false, text: 'Relatórios Executivos' },
    ai_categorization: { enabled: false, text: 'Categorização inteligente via IA' },
    predictive_analysis: { enabled: false, text: 'Análise preditiva de gastos' },
    priority_support: { enabled: false, text: 'Suporte prioritário' },
  },
  pro: {
    transactions_unlimited: { enabled: true, text: 'Transações ilimitadas' },
    csv_import: { enabled: true, text: 'Importação CSV' },
    ofx_import: { enabled: true, text: 'Importação OFX' },
    ai_advisor: { enabled: true, text: 'AI Advisor (10 consultas/mês)' },
    budgets: { enabled: true, text: 'Orçamentos e Projeções' },
    investments: { enabled: true, text: 'Investimentos e Dívidas' },
    goals: { enabled: true, text: 'Patrimônio e Objetivos' },
    pluggy_integration: { enabled: false, text: 'Integração Bancária (Open Finance)' },
    whatsapp_integration: { enabled: true, text: 'Integração WhatsApp' },
    reports: { enabled: true, text: 'Relatórios Executivos' },
    ai_categorization: { enabled: false, text: 'Categorização inteligente via IA' },
    predictive_analysis: { enabled: false, text: 'Análise preditiva de gastos' },
    priority_support: { enabled: false, text: 'Suporte por email' },
  },
  premium: {
    transactions_unlimited: { enabled: true, text: 'Transações ilimitadas' },
    csv_import: { enabled: true, text: 'Importação CSV' },
    ofx_import: { enabled: true, text: 'Importação OFX' },
    ai_advisor: { enabled: true, text: 'AI Advisor (100 consultas/mês)' },
    budgets: { enabled: true, text: 'Orçamentos e Projeções' },
    investments: { enabled: true, text: 'Investimentos e Dívidas' },
    goals: { enabled: true, text: 'Patrimônio e Objetivos' },
    pluggy_integration: { enabled: true, text: 'Integração Bancária (Open Finance)' },
    whatsapp_integration: { enabled: true, text: 'Integração WhatsApp' },
    reports: { enabled: true, text: 'Relatórios Executivos' },
    ai_categorization: { enabled: true, text: 'Categorização inteligente via IA' },
    predictive_analysis: { enabled: true, text: 'Análise preditiva de gastos' },
    priority_support: { enabled: true, text: 'Suporte prioritário via WhatsApp' },
  },
};

export default function PlanFeaturesSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'free' | 'pro' | 'premium' | 'display'>('free');
  const [features, setFeatures] = useState<PlanFeaturesData>({});
  const [displayConfig, setDisplayConfig] = useState<PlanDisplayConfig>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/plan-features');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      
      setFeatures({
        plan_features_free: data.plan_features_free || DEFAULT_FEATURES.free,
        plan_features_pro: data.plan_features_pro || DEFAULT_FEATURES.pro,
        plan_features_premium: data.plan_features_premium || DEFAULT_FEATURES.premium,
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
      const res = await fetch('/api/admin/plan-features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...features,
          plan_display_config: displayConfig,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

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
    updates: Partial<{ enabled: boolean; text: string }>
  ) => {
    const planKey = `plan_features_${plan}` as keyof PlanFeaturesData;
    const currentFeatures = (features[planKey] as PlanFeatures) || {};
    
    setFeatures({
      ...features,
      [planKey]: {
        ...currentFeatures,
        [featureId]: {
          ...currentFeatures[featureId],
          ...updates,
        },
      },
    });
  };

  const getCurrentPlanFeatures = (plan: 'free' | 'pro' | 'premium'): PlanFeatures => {
    const planKey = `plan_features_${plan}` as keyof PlanFeaturesData;
    return (features[planKey] as PlanFeatures) || DEFAULT_FEATURES[plan];
  };

  const getEnabledFeatures = (plan: 'free' | 'pro' | 'premium') => {
    const planFeatures = getCurrentPlanFeatures(plan);
    return Object.entries(planFeatures)
      .filter(([_, feature]) => feature.enabled)
      .map(([id, feature]) => ({ id, text: feature.text }));
  };

  const renderFeaturesByCategory = (plan: 'free' | 'pro' | 'premium') => {
    const planFeatures = getCurrentPlanFeatures(plan);
    
    return Object.entries(FEATURE_CATEGORIES).map(([categoryId, category]) => {
      const categoryFeatures = category.features
        .filter(featureId => planFeatures[featureId])
        .map(featureId => ({ id: featureId, ...planFeatures[featureId] }));
      
      if (categoryFeatures.length === 0) return null;
      
      return (
        <div key={categoryId} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
            <i className={`bx ${category.icon}`}></i>
            <span>{category.label}</span>
          </div>
          <div className="space-y-2">
            {categoryFeatures.map(feature => (
              <div key={feature.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${plan}-${feature.id}-text`} className="text-sm font-medium">
                      {feature.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Label>
                    {FEATURE_PANEL_MAP[feature.id] && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {FEATURE_PANEL_MAP[feature.id]}
                      </span>
                    )}
                  </div>
                  <Input
                    id={`${plan}-${feature.id}-text`}
                    value={feature.text}
                    onChange={(e) => updateFeature(plan, feature.id, { text: e.target.value })}
                    className="mt-1 h-8 text-sm"
                    placeholder="Texto que aparece na landing page"
                  />
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <Switch
                      id={`${plan}-${feature.id}-enabled`}
                      checked={feature.enabled}
                      onCheckedChange={(checked) => updateFeature(plan, feature.id, { enabled: checked })}
                    />
                    <span className="text-xs text-muted-foreground mt-1">
                      {feature.enabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    });
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
                  {renderFeaturesByCategory('free')}
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
                  {renderFeaturesByCategory('pro')}
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
                  {renderFeaturesByCategory('premium')}
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
