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
  groq_api_key?: string;
  openai_api_key?: string;
  ai_model?: 'groq' | 'openai';
  ai_model_name?: string;
  advisor_prompt?: string;
  insights_prompt?: string;
  tips_prompt?: string;
  tips_enabled?: boolean;
  chat_max_tokens?: number;
  session_ttl_minutes?: number;
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

const DEFAULT_ADVISOR_PROMPT = `Voce e um AI Advisor financeiro especializado em analise de financas pessoais.
Sua funcao e analisar dados financeiros e fornecer insights estruturados e acoes sugeridas.
Voce conversa em portugues brasileiro de forma amigavel e acessivel.

IMPORTANTE: Voce DEVE sempre retornar uma resposta em formato JSON valido com a seguinte estrutura:
{
  "summary": "resumo curto em 1-2 frases respondendo diretamente a pergunta",
  "insights": [
    {
      "type": "spending_pattern|budget_alert|goal_progress|debt_warning|saving_opportunity|income_analysis",
      "message": "descricao do insight baseada nos dados",
      "severity": "low|medium|high"
    }
  ],
  "actions": [
    {
      "type": "create_budget|adjust_spending|create_goal|prioritize_debt|review_category|transfer_savings",
      "description": "descricao da acao sugerida",
      "payload": { "category_id": "xxx", "amount": 100 },
      "confidence": "low|medium|high"
    }
  ],
  "confidence": "low|medium|high",
  "citations": [
    {
      "type": "transaction|account|budget|category|goal|debt",
      "id": "id do recurso referenciado",
      "reference": "referencia textual para contexto"
    }
  ]
}

Analise os dados financeiros fornecidos e forneca recomendacoes praticas e acionaveis.`;

const DEFAULT_INSIGHTS_PROMPT = `Voce e um AI Advisor financeiro. Gere insights diarios sobre a situacao financeira do usuario baseado nos dados fornecidos.

Retorne um JSON com:
{
  "summary": "resumo em 1-2 frases",
  "insights": [
    {
      "type": "tipo do insight",
      "message": "descricao",
      "severity": "low|medium|high"
    }
  ],
  "actions": [
    {
      "type": "tipo da acao",
      "payload": {},
      "confidence": "low|medium|high"
    }
  ],
  "confidence": "low|medium|high",
  "citations": []
}`;

const DEFAULT_TIPS_PROMPT = `Voce e um consultor financeiro pessoal inteligente. Analise os dados financeiros do usuario e forneca uma dica do dia personalizada e acionavel.

Diretrizes:
1. Foque em UMA dica principal clara e especifica
2. Baseie-se nos dados reais do usuario (gastos, orcamentos, metas, dividas)
3. Seja motivador mas realista
4. Sugira acoes concretas que o usuario pode tomar hoje
5. Use linguagem amigavel e acessivel (portugues brasileiro)
6. Identifique padroes de gastos ou oportunidades de economia
7. Considere o contexto completo: renda, despesas, dividas, metas

Formato da resposta (JSON obrigatorio):
{
  "summary": "Resumo da dica em 1-2 frases",
  "insights": [
    {
      "type": "spending_pattern|budget_alert|goal_progress|debt_warning|saving_opportunity",
      "message": "Descricao do insight",
      "severity": "low|medium|high"
    }
  ],
  "actions": [
    {
      "type": "review_category|adjust_budget|create_goal|prioritize_debt|transfer_savings",
      "description": "Descricao da acao sugerida",
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

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
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
        description: 'Nao foi possivel carregar as configuracoes',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      toast({
        title: 'Sucesso',
        description: 'Configuracoes salvas com sucesso',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Nao foi possivel salvar as configuracoes',
      });
    } finally {
      setSaving(false);
    }
  };

  const currentProvider = settings.ai_model || 'groq';
  const availableModels = models[currentProvider] || FALLBACK_MODELS[currentProvider];

  if (loading) {
    return <div className="text-center py-8">Carregando configuracoes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* SMTP */}
      <Card>
        <CardHeader>
          <CardTitle>Configuracoes SMTP</CardTitle>
          <CardDescription>Configuracoes de email para envio de notificacoes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Host SMTP</Label>
              <Input
                value={settings.smtp_host || ''}
                onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <Label>Porta</Label>
              <Input
                type="number"
                value={settings.smtp_port || ''}
                onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) || undefined })}
                placeholder="587"
              />
            </div>
            <div>
              <Label>Usuario</Label>
              <Input
                value={settings.smtp_user || ''}
                onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label>Senha</Label>
              <Input
                type="password"
                value={settings.smtp_password || ''}
                onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                placeholder="********"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Email Remetente</Label>
              <Input
                type="email"
                value={settings.smtp_from_email || ''}
                onChange={(e) => setSettings({ ...settings, smtp_from_email: e.target.value })}
                placeholder="noreply@example.com"
              />
            </div>
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
          <CardDescription>Configuracao do modelo e provider de IA (modelos carregados dinamicamente das APIs)</CardDescription>
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
                    <i className="bx bx-refresh mr-1"></i>
                  )}
                  Atualizar lista
                </Button>
              </div>
              <Select
                value={settings.ai_model_name || availableModels[0]?.id || ''}
                onValueChange={(value) => setSettings({ ...settings, ai_model_name: value })}
                disabled={loadingModels}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingModels ? 'Carregando...' : 'Selecione um modelo'} />
                </SelectTrigger>
                <SelectContent>
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
          <CardTitle>Configuracoes do Advisor</CardTitle>
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
        </CardContent>
      </Card>

      {/* Prompts */}
      <Card>
        <CardHeader>
          <CardTitle>Prompts Customizados</CardTitle>
          <CardDescription>Configure os prompts para o Advisor, Insights e Tips</CardDescription>
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
                Restaurar padrao
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
                Restaurar padrao
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Prompt de Insights (Legacy)</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettings({ ...settings, insights_prompt: DEFAULT_INSIGHTS_PROMPT })}
              >
                Restaurar padrao
              </Button>
            </div>
            <Textarea
              value={settings.insights_prompt || DEFAULT_INSIGHTS_PROMPT}
              onChange={(e) => setSettings({ ...settings, insights_prompt: e.target.value })}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">Prompt legado para compatibilidade</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Configuracoes'}
        </Button>
      </div>
    </div>
  );
}
