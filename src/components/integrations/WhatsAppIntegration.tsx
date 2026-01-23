'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppStatus {
  enabled: boolean;
  configured: boolean;
  phoneNumber: string | null;
  phoneNumberRaw: string | null;
  status: 'pending' | 'verified' | 'expired' | 'revoked' | null;
  verifiedAt: string | null;
  verified: boolean;
  message?: string;
  instancePhoneNumber: string | null;
  error?: string;
  requiresUpgrade?: boolean;
  currentPlan?: string;
}

interface WhatsAppIntegrationProps {
  onStatusChange?: () => void;
}

type ViewState = 'loading' | 'not_available' | 'not_registered' | 'pending_verification' | 'verified';

export default function WhatsAppIntegration({ onStatusChange }: WhatsAppIntegrationProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();

      if (res.status === 403 && data.requiresUpgrade) {
        // Plan doesn't have WhatsApp access - show upgrade message
        setStatus({
          enabled: false,
          configured: false,
          phoneNumber: null,
          phoneNumberRaw: null,
          status: null,
          verifiedAt: null,
          verified: false,
          message: `A integração WhatsApp está disponível apenas nos planos Pro e Premium. Seu plano atual: ${data.currentPlan || 'Free'}`,
          instancePhoneNumber: null,
          error: data.error,
          requiresUpgrade: true,
          currentPlan: data.currentPlan,
        });
        setLoading(false);
        return;
      }

      if (!res.ok) {
        // Other errors - show error message
        setStatus({
          enabled: false,
          configured: false,
          phoneNumber: null,
          phoneNumberRaw: null,
          status: null,
          verifiedAt: null,
          verified: false,
          message: data.error || data.message || 'Erro ao verificar status do WhatsApp',
          instancePhoneNumber: null,
          error: data.error,
        });
        setLoading(false);
        return;
      }

      setStatus(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error);
      setStatus({
        enabled: false,
        configured: false,
        phoneNumber: null,
        phoneNumberRaw: null,
        status: null,
        verifiedAt: null,
        verified: false,
        message: 'Erro ao conectar com o servidor. Tente novamente mais tarde.',
        instancePhoneNumber: null,
        error: 'Network error',
      });
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleRegister = async () => {
    if (!phoneNumber) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Digite seu número de WhatsApp',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/whatsapp/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar número');
      }

      toast({
        title: 'Código enviado',
        description: 'Verifique seu WhatsApp para o código de verificação',
      });

      setResendCooldown(60);
      fetchStatus();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Digite o código de 6 dígitos',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/whatsapp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Código inválido');
      }

      toast({
        title: 'Sucesso!',
        description: 'Seu WhatsApp foi verificado com sucesso',
      });

      setVerificationCode('');
      fetchStatus();
      onStatusChange?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/whatsapp/resend', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao reenviar código');
      }

      toast({
        title: 'Código reenviado',
        description: 'Verifique seu WhatsApp',
      });

      setResendCooldown(60);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar seu WhatsApp?')) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao desconectar');
      }

      toast({
        title: 'WhatsApp desconectado',
        description: 'Você pode conectar novamente a qualquer momento',
      });

      setPhoneNumber('');
      fetchStatus();
      onStatusChange?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getViewState = (): ViewState => {
    if (loading) return 'loading';
    if (!status || !status.enabled || !status.configured) return 'not_available';
    if (status.verified) return 'verified';
    if (status.status === 'pending') return 'pending_verification';
    return 'not_registered';
  };

  const viewState = getViewState();

  if (viewState === 'loading') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <i className="bxl bx-whatsapp text-green-500 text-2xl"></i>
            WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <i className="bx bx-loader-alt bx-spin"></i>
            <span>Carregando...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (viewState === 'not_available') {
    const isUpgradeRequired = status?.requiresUpgrade;
    
    return (
      <Card className={`${isUpgradeRequired ? 'border-blue-500/20 bg-blue-500/5' : 'border-yellow-500/20 bg-yellow-500/5'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <i className="bxl bx-whatsapp text-green-500 text-2xl"></i>
            WhatsApp
          </CardTitle>
          <CardDescription>
            Gerencie suas transações por mensagens de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`flex items-start gap-2 ${isUpgradeRequired ? 'text-blue-600' : 'text-yellow-600'}`}>
            <i className={`bx ${isUpgradeRequired ? 'bx-up-arrow-circle' : 'bx-info-circle'} mt-0.5`}></i>
            <div className="flex-1">
              <p className="font-medium mb-1">
                {status?.message || 'Esta integração será disponibilizada em breve'}
              </p>
              {isUpgradeRequired && (
                <a
                  href="/pricing"
                  className="text-sm underline hover:no-underline mt-2 inline-block"
                >
                  Ver planos disponíveis →
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (viewState === 'verified') {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <i className="bxl bx-whatsapp text-green-500 text-2xl"></i>
            WhatsApp
            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
              Conectado
            </span>
          </CardTitle>
          <CardDescription>
            Gerencie suas transações por mensagens de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{status?.phoneNumber}</p>
              <p className="text-sm text-muted-foreground">
                Verificado em {status?.verifiedAt ? new Date(status.verifiedAt).toLocaleDateString('pt-BR') : '-'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Desconectar
            </Button>
          </div>

          {status?.instancePhoneNumber && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <i className="bx bx-message-dots text-green-600"></i>
                Envie mensagens para:
              </p>
              <a
                href={`https://wa.me/${status.instancePhoneNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-bold text-green-600 hover:underline flex items-center gap-2"
              >
                {status.instancePhoneNumber}
                <i className="bx bx-link-external text-sm"></i>
              </a>
              <p className="text-xs text-muted-foreground mt-1">
                Clique para abrir no WhatsApp
              </p>
            </div>
          )}

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Como usar:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- Envie mensagens de texto ou áudio</li>
              <li>- Ex: &quot;Gastei 50 reais no mercado&quot;</li>
              <li>- Ex: &quot;Recebi 1000 de salário&quot;</li>
              <li>- Ex: &quot;Quanto tenho na conta?&quot;</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (viewState === 'pending_verification') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <i className="bxl bx-whatsapp text-green-500 text-2xl"></i>
            WhatsApp
            <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded-full">
              Verificação Pendente
            </span>
          </CardTitle>
          <CardDescription>
            Digite o código de 6 dígitos enviado para {status?.phoneNumber}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verification_code">Código de Verificação</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="verification_code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full sm:max-w-[150px] text-center text-2xl tracking-widest"
              />
              <Button onClick={handleVerify} disabled={submitting || verificationCode.length !== 6}>
                {submitting ? (
                  <i className="bx bx-loader-alt bx-spin mr-1"></i>
                ) : (
                  <i className="bx bx-check mr-1"></i>
                )}
                Verificar
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={submitting || resendCooldown > 0}
            >
              {resendCooldown > 0 ? (
                `Reenviar em ${resendCooldown}s`
              ) : (
                <>
                  <i className="bx bx-repeat mr-1"></i>
                  Reenviar código
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPhoneNumber('');
                handleDisconnect();
              }}
              disabled={submitting}
            >
              Usar outro número
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // not_registered
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <i className="bxl bx-whatsapp text-green-500 text-2xl"></i>
          WhatsApp
        </CardTitle>
        <CardDescription>
          Conecte seu WhatsApp para gerenciar transações por mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone_number">Número do WhatsApp</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="phone_number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+5511999999999"
                className="w-full sm:max-w-[200px]"
              />
              <Button onClick={handleRegister} disabled={submitting || !phoneNumber}>
                {submitting ? (
                  <i className="bx bx-loader-alt bx-spin mr-1"></i>
                ) : (
                <i className="bx bx-send mr-1"></i>
              )}
              Enviar Código
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Você receberá um código de verificação no WhatsApp
          </p>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-2">Com esta integração você pode:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>- Registrar transações por mensagem de texto ou áudio</li>
            <li>- Consultar saldos e resumos</li>
            <li>- Receber lembretes e alertas</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
