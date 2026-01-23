'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface PluggySettingsData {
  pluggy_client_id?: string;
  pluggy_client_id_set?: boolean;
  pluggy_client_secret?: string;
  pluggy_client_secret_set?: boolean;
  pluggy_enabled?: boolean;
  categorization_prompt?: string;
}

interface PluggyStatusData {
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  message?: string;
}

const DEFAULT_CATEGORIZATION_PROMPT = `Voce e um assistente financeiro especializado em categorizar transacoes bancarias.
Analise as transacoes abaixo e sugira a categoria mais adequada baseado na descricao.

Categorias disponiveis: {categories}

Para cada transacao, retorne um JSON valido com a seguinte estrutura:
{
  "transactions": [
    { "id": "id_da_transacao", "category": "nome_categoria_exato", "confidence": "low|medium|high" }
  ]
}

Regras:
1. Use APENAS categorias da lista fornecida
2. Se nao conseguir identificar com certeza, use "Outros" com confidence "low"
3. Analise palavras-chave comuns: supermercado, restaurante, uber, ifood, netflix, etc.
4. Considere o valor da transacao para contexto adicional
5. Retorne APENAS o JSON, sem explicacoes adicionais`;

export default function PluggySettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PluggySettingsData>({});
  const [status, setStatus] = useState<PluggyStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pluggy/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      
      // DEBUG: Log API response
      console.log('[PluggySettings] API Response:', {
        pluggy_client_id_set: data.pluggy_client_id_set,
        pluggy_client_secret_set: data.pluggy_client_secret_set,
        pluggy_enabled: data.pluggy_enabled,
        hasCategorizationPrompt: !!data.categorization_prompt,
      });
      
      setSettings({
        ...data,
        categorization_prompt: data.categorization_prompt || DEFAULT_CATEGORIZATION_PROMPT,
      });
    } catch (error) {
      console.error('Error fetching Pluggy settings:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Nao foi possivel carregar as configuracoes',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pluggy/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching Pluggy status:', error);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (!loading) {
      fetchStatus();
    }
  }, [loading, fetchStatus]);

  const handleSave = async () => {
    setSaving(true);
    
    // DEBUG: Log what we're sending
    console.log('[PluggySettings] Saving settings:', {
      hasClientId: !!settings.pluggy_client_id,
      clientIdLength: settings.pluggy_client_id?.length,
      hasClientSecret: !!settings.pluggy_client_secret,
      clientSecretLength: settings.pluggy_client_secret?.length,
      pluggyEnabled: settings.pluggy_enabled,
    });
    
    try {
      const res = await fetch('/api/admin/pluggy/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const responseData = await res.json();
      console.log('[PluggySettings] Save response:', responseData);

      if (!res.ok) throw new Error(responseData.error || 'Failed to save settings');

      toast({
        title: 'Sucesso',
        description: 'Configuracoes salvas com sucesso',
      });

      // Refresh status and settings after save
      fetchStatus();
      fetchSettings();
    } catch (error) {
      console.error('Error saving Pluggy settings:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Nao foi possivel salvar as configuracoes',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await fetch('/api/admin/pluggy/test', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to test connection');
      }

      toast({
        title: 'Sucesso',
        description: 'Conexao com Pluggy API testada com sucesso!',
      });

      fetchStatus();
    } catch (error: any) {
      console.error('Error testing Pluggy connection:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Nao foi possivel conectar ao Pluggy',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando configuracoes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <i className="bx bx-share text-primary text-2xl"></i>
            Status Open Finance
          </CardTitle>
          <CardDescription>
            Status de conexao com a API Pluggy para Open Finance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  status?.connected
                    ? 'bg-green-500'
                    : status?.configured
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-sm font-medium">
                {status?.connected
                  ? 'Conectado'
                  : status?.configured
                  ? 'Credenciais configuradas'
                  : 'Nao configurado'}
              </span>
            </div>
            {status?.enabled && (
              <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full">
                Habilitado
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingConnection || !settings.pluggy_client_id_set}
            >
              {testingConnection ? (
                <i className="bx bx-loader-alt bx-spin mr-1"></i>
              ) : (
                <i className="bx bx-check-circle mr-1"></i>
              )}
              Testar Conexao
            </Button>
          </div>
          {status?.message && (
            <p className="text-sm text-muted-foreground mt-2">{status.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Pluggy API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Credenciais Pluggy API</CardTitle>
          <CardDescription>
            Configure as credenciais da sua aplicacao Pluggy para habilitar a integracao Open Finance.
            Obtenha as credenciais no{' '}
            <a
              href="https://dashboard.pluggy.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Dashboard Pluggy
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label>Habilitar Open Finance</Label>
              <p className="text-sm text-muted-foreground">
                Ativar integracao bancaria via Pluggy (apenas para testes de superadmin)
              </p>
            </div>
            <Switch
              checked={settings.pluggy_enabled || false}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, pluggy_enabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="pluggy_client_id">Client ID</Label>
              <Input
                id="pluggy_client_id"
                type="password"
                value={settings.pluggy_client_id || ''}
                onChange={(e) =>
                  setSettings({ ...settings, pluggy_client_id: e.target.value })
                }
                placeholder={settings.pluggy_client_id_set ? '********' : 'Digite o Client ID'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Client ID da sua aplicacao Pluggy
              </p>
            </div>
            <div>
              <Label htmlFor="pluggy_client_secret">Client Secret</Label>
              <Input
                id="pluggy_client_secret"
                type="password"
                value={settings.pluggy_client_secret || ''}
                onChange={(e) =>
                  setSettings({ ...settings, pluggy_client_secret: e.target.value })
                }
                placeholder={settings.pluggy_client_secret_set ? '********' : 'Digite o Client Secret'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Client Secret da sua aplicacao Pluggy
              </p>
            </div>
          </div>

          <div className="rounded-md bg-muted p-4">
            <p className="text-sm font-medium mb-2">Informacoes importantes:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>A integracao Open Finance esta disponivel apenas para usuarios SuperAdmin</li>
              <li>Use o ambiente Sandbox para testes antes de habilitar em producao</li>
              <li>Credenciais de teste: user-ok / password-ok (Sandbox Pluggy Bank)</li>
              <li>Webhook URL para configurar no Pluggy: <code className="bg-background px-1 rounded">/api/pluggy/callback</code></li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* AI Categorization */}
      <Card>
        <CardHeader>
          <CardTitle>Categorizacao Automatica (IA)</CardTitle>
          <CardDescription>
            Configure o prompt usado pela IA para categorizar transacoes automaticamente durante importacoes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Prompt de Categorizacao</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettings({ ...settings, categorization_prompt: DEFAULT_CATEGORIZATION_PROMPT })}
              >
                Restaurar padrao
              </Button>
            </div>
            <Textarea
              value={settings.categorization_prompt || DEFAULT_CATEGORIZATION_PROMPT}
              onChange={(e) => setSettings({ ...settings, categorization_prompt: e.target.value })}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use {'{categories}'} como placeholder para a lista de categorias do usuario
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Configuracoes'}
        </Button>
      </div>
    </div>
  );
}
