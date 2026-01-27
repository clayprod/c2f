'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface GlobalSettingsData {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_from_email?: string;
  smtp_secure?: boolean;
  groq_api_key?: string;
  openai_api_key?: string;
  ai_model?: 'groq' | 'openai';
  ai_model_name?: string;
  advisor_prompt?: string;
  tips_prompt?: string;
  tips_enabled?: boolean;
  chat_max_tokens?: number;
  session_ttl_minutes?: number;
  advisor_limit_pro?: number;
  advisor_limit_premium?: number;
  support_email?: string;
  support_whatsapp?: string;
}

interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
}

// Fallback models (used while loading or on error)
const FALLBACK_MODELS = {
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
};

const DEFAULT_ADVISOR_PROMPT = `Você é um AI Advisor financeiro especializado em análise de finanças pessoais.
Sua função é analisar dados financeiros e fornecer insights estruturados e ações sugeridas.
Você conversa em português brasileiro de forma amigável e acessível.

IMPORTANTE: Você DEVE sempre retornar uma resposta em formato JSON válido com a seguinte estrutura:
{
  "summary": "resumo curto em 1-2 frases respondendo diretamente a pergunta",
  "insights": [
    {
      "type": "spending_pattern|budget_alert|goal_progress|debt_warning|saving_opportunity|income_analysis",
      "message": "descrição do insight baseada nos dados",
      "severity": "low|medium|high"
    }
  ],
  "actions": [
    {
      "type": "create_budget|adjust_spending|create_goal|prioritize_debt|review_category|transfer_savings",
      "description": "descrição da ação sugerida",
      "payload": { "category_id": "xxx", "amount": 100 },
      "confidence": "low|medium|high"
    }
  ],
  "confidence": "low|medium|high",
  "citations": [
    {
      "type": "transaction|account|budget|category|goal|debt",
      "id": "id do recurso referenciado",
      "reference": "referência textual para contexto"
    }
  ]
}

Analise os dados financeiros fornecidos e forneça recomendações práticas e acionáveis.`;

const DEFAULT_TIPS_PROMPT = `Você é um consultor financeiro pessoal inteligente. Analise os dados financeiros do usuário e forneça uma dica do dia personalizada e acionável.

Diretrizes:
1. Foque em UMA dica principal clara e específica
2. Baseie-se nos dados reais do usuário (gastos, orçamentos, metas, dívidas)
3. Seja motivador mas realista
4. Sugira ações concretas que o usuário pode tomar hoje
5. Use linguagem amigável e acessível (português brasileiro)
6. Identifique padrões de gastos ou oportunidades de economia
7. Considere o contexto completo: renda, despesas, dívidas, metas

Formato da resposta (JSON obrigatório):
{
  "summary": "Resumo da dica em 1-2 frases",
  "insights": [
    {
      "type": "spending_pattern|budget_alert|goal_progress|debt_warning|saving_opportunity",
      "message": "Descrição do insight",
      "severity": "low|medium|high"
    }
  ],
  "actions": [
    {
      "type": "review_category|adjust_budget|create_goal|prioritize_debt|transfer_savings",
      "description": "Descrição da ação sugerida",
      "payload": {},
      "confidence": "low|medium|high"
    }
  ],
  "confidence": "low|medium|high",
  "citations": []
}`;

export default function GlobalSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<GlobalSettingsData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState<{ groq: ModelInfo[]; openai: ModelInfo[] }>({
    groq: FALLBACK_MODELS.groq,
    openai: FALLBACK_MODELS.openai,
  });
  const [loadingModels, setLoadingModels] = useState(false);

  const fetchSettings = async () => {
    try {
      // Clear cache first to ensure fresh data
      await fetch('/api/admin/settings/clear-cache', { method: 'POST' });

      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();

      console.log('[GlobalSettings] Fetched data:', {
        hasSupportEmail: !!data.support_email,
        hasSupportWhatsapp: !!data.support_whatsapp,
        supportEmail: data.support_email,
        supportWhatsapp: data.support_whatsapp,
      });

      setSettings({
        ...data,
        tips_enabled: data.tips_enabled !== false, // Default to true
        chat_max_tokens: data.chat_max_tokens || 4000,
        session_ttl_minutes: data.session_ttl_minutes || 30,
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as configurações',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = useCallback(async (provider: 'groq' | 'openai', refresh = false) => {
    setLoadingModels(true);
    try {
      const url = `/api/admin/models?provider=${provider}${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setModels(prev => ({
          ...prev,
          [provider]: data.models.length > 0 ? data.models : FALLBACK_MODELS[provider],
        }));
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, []);

  // Fetch models when settings are loaded
  useEffect(() => {
    if (!loading && settings.ai_model) {
      fetchModels(settings.ai_model);
    }
  }, [loading, settings.ai_model, fetchModels]);

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log('[GlobalSettings] Saving settings:', {
        hasSupportEmail: !!settings.support_email,
        hasSupportWhatsapp: !!settings.support_whatsapp,
        supportEmail: settings.support_email,
        supportWhatsapp: settings.support_whatsapp,
      });

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('[GlobalSettings] Save error:', errorData);
        throw new Error('Failed to save settings');
      }

      toast({
        title: 'Sucesso',
        description: 'Configurações salvas com sucesso',
      });

      // Reload settings to reflect saved data
      await fetchSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar as configurações',
      });
    } finally {
      setSaving(false);
    }
  };

  const currentProvider = settings.ai_model || 'groq';
  const availableModels = models[currentProvider] || FALLBACK_MODELS[currentProvider];

  if (loading) {
    return <div className="text-center py-8">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Support Contacts - Moved to top for visibility */}
      <Card>
        <CardHeader>
          <CardTitle>Contatos de Suporte</CardTitle>
          <CardDescription>Configure os contatos exibidos na central de ajuda e páginas de suporte</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="support_email">Email de Suporte</Label>
              <Input
                id="support_email"
                type="email"
                value={settings.support_email || ''}
                onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                placeholder="contato@c2finance.com.br"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email exibido na central de ajuda para contato
              </p>
            </div>
            <div>
              <Label htmlFor="support_whatsapp">WhatsApp de Suporte</Label>
              <Input
                id="support_whatsapp"
                type="text"
                value={settings.support_whatsapp || ''}
                onChange={(e) => setSettings({ ...settings, support_whatsapp: e.target.value })}
                placeholder="+5511999999999"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Número do WhatsApp (formato: +5511999999999)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMTP */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações SMTP</CardTitle>
          <CardDescription>Configurações de email para envio de notificações e emails transacionais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="smtp_host">Host SMTP</Label>
              <Input
                id="smtp_host"
                value={settings.smtp_host || ''}
                onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                placeholder="smtp.gmail.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ex: smtp.gmail.com, smtp.sendgrid.net
              </p>
            </div>
            <div>
              <Label htmlFor="smtp_port">Porta</Label>
              <Input
                id="smtp_port"
                type="number"
                value={settings.smtp_port || ''}
                onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) || undefined })}
                placeholder="587"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Porta padrão: 587 (TLS), 465 (SSL), 25 (não seguro)
              </p>
            </div>
            <div>
              <Label htmlFor="smtp_user">Usuário</Label>
              <Input
                id="smtp_user"
                value={settings.smtp_user || ''}
                onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                placeholder="user@example.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email ou usuário do servidor SMTP
              </p>
            </div>
            <div>
              <Label htmlFor="smtp_password">Senha</Label>
              <Input
                id="smtp_password"
                type="password"
                value={settings.smtp_password || ''}
                onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                placeholder="********"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Senha ou app password do servidor SMTP
              </p>
            </div>
            <div>
              <Label htmlFor="smtp_from_email">Email Remetente</Label>
              <Input
                id="smtp_from_email"
                type="email"
                value={settings.smtp_from_email || ''}
                onChange={(e) => setSettings({ ...settings, smtp_from_email: e.target.value })}
                placeholder="noreply@example.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email que aparecerá como remetente
              </p>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="smtp_secure">Usar Conexão Segura (TLS/SSL)</Label>
                <p className="text-sm text-muted-foreground">Habilitar TLS/SSL para conexão segura (recomendado)</p>
              </div>
              <Switch
                id="smtp_secure"
                checked={settings.smtp_secure !== false}
                onCheckedChange={(checked) => setSettings({ ...settings, smtp_secure: checked })}
              />
            </div>
          </div>
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm font-medium mb-2">Dicas de Configuração SMTP:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Gmail:</strong> smtp.gmail.com, porta 587 (TLS) ou 465 (SSL), use App Password</li>
              <li><strong>SendGrid:</strong> smtp.sendgrid.net, porta 587, use API Key como senha</li>
              <li><strong>Outlook/Hotmail:</strong> smtp-mail.outlook.com, porta 587</li>
              <li><strong>Amazon SES:</strong> Use as credenciais SMTP fornecidas pela AWS</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>Chaves de API</CardTitle>
          <CardDescription>Chaves para servicos de IA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Groq API Key</Label>
              <Input
                type="password"
                value={settings.groq_api_key || ''}
                onChange={(e) => setSettings({ ...settings, groq_api_key: e.target.value })}
                placeholder="gsk_..."
              />
            </div>
            <div>
              <Label>OpenAI API Key</Label>
              <Input
                type="password"
                value={settings.openai_api_key || ''}
                onChange={(e) => setSettings({ ...settings, openai_api_key: e.target.value })}
                placeholder="sk-..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Model */}
      <Card>
        <CardHeader>
          <CardTitle>Modelo de IA</CardTitle>
          <CardDescription>Configuração do modelo e provider de IA (modelos carregados dinamicamente das APIs)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Provider</Label>
              <Select
                value={currentProvider}
                onValueChange={(value: 'groq' | 'openai') => {
                  // Reset model name when changing provider and fetch models
                  const defaultModel = (models[value] || FALLBACK_MODELS[value])[0]?.id || '';
                  setSettings({ ...settings, ai_model: value, ai_model_name: defaultModel });
                  fetchModels(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Modelo</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchModels(currentProvider, true)}
                  disabled={loadingModels}
                  className="h-6 px-2 text-xs"
                >
                  {loadingModels ? (
                    <i className="bx bx-loader-alt bx-spin mr-1"></i>
                  ) : (
                    <i className="bx bx-repeat mr-1"></i>
                  )}
                  Atualizar lista
                </Button>
              </div>
              <Select
                value={settings.ai_model_name || availableModels[0]?.id || ''}
                onValueChange={(value) => {
                  console.log('Model selected:', value);
                  setSettings({ ...settings, ai_model_name: value });
                }}
                disabled={loadingModels || availableModels.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingModels ? 'Carregando...' : availableModels.length === 0 ? 'Nenhum modelo disponível' : 'Selecione um modelo'} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                      {model.contextWindow && (
                        <span className="text-muted-foreground text-xs ml-2">
                          ({Math.round(model.contextWindow / 1000)}k ctx)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {availableModels.length} modelos disponiveis
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advisor Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Advisor</CardTitle>
          <CardDescription>Controle de sessao e limites</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Tips Diarias</Label>
                <p className="text-sm text-muted-foreground">Habilitar dicas diarias no dashboard</p>
              </div>
              <Switch
                checked={settings.tips_enabled !== false}
                onCheckedChange={(checked) => setSettings({ ...settings, tips_enabled: checked })}
              />
            </div>
            <div>
              <Label>Max Tokens do Historico</Label>
              <Input
                type="number"
                value={settings.chat_max_tokens || 4000}
                onChange={(e) => setSettings({ ...settings, chat_max_tokens: parseInt(e.target.value) || 4000 })}
                min={1000}
                max={16000}
              />
              <p className="text-xs text-muted-foreground mt-1">Limite de tokens para historico do chat</p>
            </div>
            <div>
              <Label>TTL da Sessao (minutos)</Label>
              <Input
                type="number"
                value={settings.session_ttl_minutes || 30}
                onChange={(e) => setSettings({ ...settings, session_ttl_minutes: parseInt(e.target.value) || 30 })}
                min={5}
                max={120}
              />
              <p className="text-xs text-muted-foreground mt-1">Tempo de vida da sessao no Redis</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
            <div>
              <Label>Limite Mensal Advisor (PRO)</Label>
              <Input
                type="number"
                value={settings.advisor_limit_pro || 10}
                onChange={(e) => setSettings({ ...settings, advisor_limit_pro: parseInt(e.target.value) || 0 })}
                min={0}
              />
              <p className="text-xs text-muted-foreground mt-1">Consultas de IA permitidas por mês para o plano Pro</p>
            </div>
            <div>
              <Label>Limite Mensal Advisor (PREMIUM)</Label>
              <Input
                type="number"
                value={settings.advisor_limit_premium || 100}
                onChange={(e) => setSettings({ ...settings, advisor_limit_premium: parseInt(e.target.value) || 0 })}
                min={0}
              />
              <p className="text-xs text-muted-foreground mt-1">Consultas de IA permitidas por mês para o plano Premium</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prompts */}
      <Card>
        <CardHeader>
          <CardTitle>Prompts Customizados</CardTitle>
          <CardDescription>Configure os prompts para o Advisor Chat e Tips Diárias</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Prompt do Chat (Advisor)</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettings({ ...settings, advisor_prompt: DEFAULT_ADVISOR_PROMPT })}
              >
                Restaurar padrão
              </Button>
            </div>
            <Textarea
              value={settings.advisor_prompt || DEFAULT_ADVISOR_PROMPT}
              onChange={(e) => setSettings({ ...settings, advisor_prompt: e.target.value })}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">Usado nas conversas do chat</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Prompt de Tips Diarias</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettings({ ...settings, tips_prompt: DEFAULT_TIPS_PROMPT })}
              >
                Restaurar padrão
              </Button>
            </div>
            <Textarea
              value={settings.tips_prompt || DEFAULT_TIPS_PROMPT}
              onChange={(e) => setSettings({ ...settings, tips_prompt: e.target.value })}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">Usado para gerar a dica do dia no dashboard</p>
          </div>

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

