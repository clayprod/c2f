'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppSettingsData {
  evolution_api_url?: string;
  evolution_api_key?: string;
  evolution_api_key_set?: boolean;
  evolution_instance_name?: string;
  evolution_webhook_secret?: string;
  evolution_webhook_secret_set?: boolean;
  n8n_api_key?: string;
  n8n_api_key_set?: boolean;
  whatsapp_enabled?: boolean;
}

interface WhatsAppStatusData {
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  state?: string;
  instanceName?: string;
  phoneNumber?: string;
  message?: string;
}

export default function WhatsAppSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<WhatsAppSettingsData>({});
  const [status, setStatus] = useState<WhatsAppStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/whatsapp/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching WhatsApp settings:', error);
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
    setCheckingStatus(true);
    try {
      const res = await fetch('/api/admin/whatsapp/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error);
    } finally {
      setCheckingStatus(false);
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
    try {
      const res = await fetch('/api/admin/whatsapp/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      toast({
        title: 'Sucesso',
        description: 'Configuracoes salvas com sucesso',
      });

      // Refresh status after save
      fetchStatus();
    } catch (error) {
      console.error('Error saving WhatsApp settings:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Nao foi possivel salvar as configuracoes',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Digite um numero de telefone para teste',
      });
      return;
    }

    setSendingTest(true);
    try {
      const res = await fetch('/api/admin/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: testPhone }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send test message');
      }

      toast({
        title: 'Sucesso',
        description: 'Mensagem de teste enviada com sucesso',
      });
    } catch (error: any) {
      console.error('Error sending test message:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Nao foi possivel enviar mensagem de teste',
      });
    } finally {
      setSendingTest(false);
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
            <i className="bxl bx-whatsapp text-green-500 text-2xl"></i>
            Status da Instancia
          </CardTitle>
          <CardDescription>
            Status de conexao com a Evolution API
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
                  ? 'Desconectado'
                  : 'Nao configurado'}
              </span>
            </div>
            {status?.phoneNumber && (
              <span className="text-sm text-muted-foreground">
                Numero: {status.phoneNumber}
              </span>
            )}
            {status?.instanceName && (
              <span className="text-sm text-muted-foreground">
                Instancia: {status.instanceName}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={checkingStatus}
            >
              {checkingStatus ? (
                <i className="bx bx-loader-alt bx-spin mr-1"></i>
              ) : (
                <i className="bx bx-repeat mr-1"></i>
              )}
              Atualizar
            </Button>
          </div>
          {status?.message && !status?.connected && (
            <p className="text-sm text-muted-foreground mt-2">{status.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Evolution API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuracao Evolution API</CardTitle>
          <CardDescription>
            Configure a conexao com a Evolution API para integracao WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label>Habilitar WhatsApp</Label>
              <p className="text-sm text-muted-foreground">
                Ativar integracao WhatsApp para usuarios premium
              </p>
            </div>
            <Switch
              checked={settings.whatsapp_enabled || false}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, whatsapp_enabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="evolution_api_url">URL da API</Label>
              <Input
                id="evolution_api_url"
                value={settings.evolution_api_url || ''}
                onChange={(e) =>
                  setSettings({ ...settings, evolution_api_url: e.target.value })
                }
                placeholder="https://evolution.example.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL base da Evolution API
              </p>
            </div>
            <div>
              <Label htmlFor="evolution_instance_name">Nome da Instancia</Label>
              <Input
                id="evolution_instance_name"
                value={settings.evolution_instance_name || ''}
                onChange={(e) =>
                  setSettings({ ...settings, evolution_instance_name: e.target.value })
                }
                placeholder="c2f-instance"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Nome da instancia configurada no Evolution
              </p>
            </div>
            <div>
              <Label htmlFor="evolution_api_key">API Key</Label>
              <Input
                id="evolution_api_key"
                type="password"
                value={settings.evolution_api_key || ''}
                onChange={(e) =>
                  setSettings({ ...settings, evolution_api_key: e.target.value })
                }
                placeholder={settings.evolution_api_key_set ? '********' : 'Digite a API Key'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Chave de autenticacao da Evolution API
              </p>
            </div>
            <div>
              <Label htmlFor="evolution_webhook_secret">Webhook Secret</Label>
              <Input
                id="evolution_webhook_secret"
                type="password"
                value={settings.evolution_webhook_secret || ''}
                onChange={(e) =>
                  setSettings({ ...settings, evolution_webhook_secret: e.target.value })
                }
                placeholder={
                  settings.evolution_webhook_secret_set ? '********' : 'Digite o secret'
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Secret para validar webhooks (opcional)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* n8n API Key */}
      <Card>
        <CardHeader>
          <CardTitle>Integracao n8n</CardTitle>
          <CardDescription>
            Chave de API para autenticar chamadas do workflow n8n
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="n8n_api_key">API Key n8n</Label>
            <Input
              id="n8n_api_key"
              type="password"
              value={settings.n8n_api_key || ''}
              onChange={(e) =>
                setSettings({ ...settings, n8n_api_key: e.target.value })
              }
              placeholder={settings.n8n_api_key_set ? '********' : 'Digite a API Key'}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Esta chave sera usada pelo n8n para autenticar chamadas as APIs do c2f
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test Message */}
      <Card>
        <CardHeader>
          <CardTitle>Testar Integracao</CardTitle>
          <CardDescription>
            Envie uma mensagem de teste para verificar se a integracao esta funcionando
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+5511999999999"
              className="max-w-xs"
            />
            <Button
              onClick={handleTestMessage}
              disabled={sendingTest || !status?.connected}
              variant="outline"
            >
              {sendingTest ? (
                <i className="bx bx-loader-alt bx-spin mr-1"></i>
              ) : (
                <i className="bx bx-send mr-1"></i>
              )}
              Enviar Teste
            </Button>
          </div>
          {!status?.connected && (
            <p className="text-sm text-yellow-600">
              A instancia precisa estar conectada para enviar mensagens de teste
            </p>
          )}
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
