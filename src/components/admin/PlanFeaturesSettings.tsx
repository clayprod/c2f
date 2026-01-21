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

const DEFAULT_FEATURES: Record<'free' | 'pro' | 'premium', PlanFeatures> = {
  free: {
    transactions_limit: { enabled: true, text: 'Até 100 transações/mês' },
    csv_import: { enabled: true, text: 'Importação CSV' },
    ofx_import: { enabled: false, text: 'Importação OFX' },
    ai_advisor: { enabled: false, text: 'AI Advisor' },
    budgets: { enabled: false, text: 'Orçamentos e Projeções' },
    investments: { enabled: false, text: 'Investimentos e Dívidas' },
    goals: { enabled: false, text: 'Patrimônio e Objetivos' },
    pluggy_integration: { enabled: false, text: 'Integração Bancária' },
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
    pluggy_integration: { enabled: false, text: 'Integração Bancária' },
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
    pluggy_integration: { enabled: true, text: 'Integração Bancária' },
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
            <TabsContent value="free" className="space-y-4 mt-6">
              <div className="space-y-4">
                {Object.entries(getCurrentPlanFeatures('free')).map(([featureId, feature]) => (
                  <div key={featureId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor={`free-${featureId}-text`} className="text-sm font-medium">
                        {featureId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                      <Input
                        id={`free-${featureId}-text`}
                        value={feature.text}
                        onChange={(e) => updateFeature('free', featureId, { text: e.target.value })}
                        className="mt-1"
                        placeholder="Texto da feature"
                      />
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <Label htmlFor={`free-${featureId}-enabled`} className="text-sm">
                        Habilitado
                      </Label>
                      <Switch
                        id={`free-${featureId}-enabled`}
                        checked={feature.enabled}
                        onCheckedChange={(checked) => updateFeature('free', featureId, { enabled: checked })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Pro Plan Features */}
            <TabsContent value="pro" className="space-y-4 mt-6">
              <div className="space-y-4">
                {Object.entries(getCurrentPlanFeatures('pro')).map(([featureId, feature]) => (
                  <div key={featureId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor={`pro-${featureId}-text`} className="text-sm font-medium">
                        {featureId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                      <Input
                        id={`pro-${featureId}-text`}
                        value={feature.text}
                        onChange={(e) => updateFeature('pro', featureId, { text: e.target.value })}
                        className="mt-1"
                        placeholder="Texto da feature"
                      />
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <Label htmlFor={`pro-${featureId}-enabled`} className="text-sm">
                        Habilitado
                      </Label>
                      <Switch
                        id={`pro-${featureId}-enabled`}
                        checked={feature.enabled}
                        onCheckedChange={(checked) => updateFeature('pro', featureId, { enabled: checked })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Premium Plan Features */}
            <TabsContent value="premium" className="space-y-4 mt-6">
              <div className="space-y-4">
                {Object.entries(getCurrentPlanFeatures('premium')).map(([featureId, feature]) => (
                  <div key={featureId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor={`premium-${featureId}-text`} className="text-sm font-medium">
                        {featureId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                      <Input
                        id={`premium-${featureId}-text`}
                        value={feature.text}
                        onChange={(e) => updateFeature('premium', featureId, { text: e.target.value })}
                        className="mt-1"
                        placeholder="Texto da feature"
                      />
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <Label htmlFor={`premium-${featureId}-enabled`} className="text-sm">
                        Habilitado
                      </Label>
                      <Switch
                        id={`premium-${featureId}-enabled`}
                        checked={feature.enabled}
                        onCheckedChange={(checked) => updateFeature('premium', featureId, { enabled: checked })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Display Configuration */}
            <TabsContent value="display" className="space-y-6 mt-6">
              <div className="grid gap-6 md:grid-cols-3">
                {(['free', 'pro', 'premium'] as const).map((plan) => (
                  <Card key={plan}>
                    <CardHeader>
                      <CardTitle className="text-lg capitalize">{plan}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor={`${plan}-name`}>Nome</Label>
                        <Input
                          id={`${plan}-name`}
                          value={displayConfig[plan]?.name || ''}
                          onChange={(e) =>
                            setDisplayConfig({
                              ...displayConfig,
                              [plan]: { ...displayConfig[plan], name: e.target.value },
                            })
                          }
                          placeholder={plan === 'free' ? 'Free' : plan === 'pro' ? 'Pro' : 'Premium'}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`${plan}-description`}>Descrição</Label>
                        <Input
                          id={`${plan}-description`}
                          value={displayConfig[plan]?.description || ''}
                          onChange={(e) =>
                            setDisplayConfig({
                              ...displayConfig,
                              [plan]: { ...displayConfig[plan], description: e.target.value },
                            })
                          }
                          placeholder="Descrição do plano"
                        />
                      </div>
                      {plan !== 'free' && (
                        <div>
                          <Label htmlFor={`${plan}-period`}>Período</Label>
                          <Input
                            id={`${plan}-period`}
                            value={displayConfig[plan]?.period || '/mês'}
                            onChange={(e) =>
                              setDisplayConfig({
                                ...displayConfig,
                                [plan]: { ...displayConfig[plan], period: e.target.value },
                              })
                            }
                            placeholder="/mês"
                          />
                        </div>
                      )}
                      {plan === 'free' && (
                        <div>
                          <Label htmlFor={`${plan}-priceFormatted`}>Preço Formatado</Label>
                          <Input
                            id={`${plan}-priceFormatted`}
                            value={displayConfig[plan]?.priceFormatted || 'Grátis'}
                            onChange={(e) =>
                              setDisplayConfig({
                                ...displayConfig,
                                [plan]: { ...displayConfig[plan], priceFormatted: e.target.value },
                              })
                            }
                            placeholder="Grátis"
                          />
                        </div>
                      )}
                      <div>
                        <Label htmlFor={`${plan}-cta`}>CTA (Call to Action)</Label>
                        <Input
                          id={`${plan}-cta`}
                          value={displayConfig[plan]?.cta || ''}
                          onChange={(e) =>
                            setDisplayConfig({
                              ...displayConfig,
                              [plan]: { ...displayConfig[plan], cta: e.target.value },
                            })
                          }
                          placeholder="Texto do botão"
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <Label htmlFor={`${plan}-popular`}>Plano Popular</Label>
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
                ))}
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
