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
        // Premium required - this will be handled by parent component
        setStatus(null);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch status');
      }

      setStatus(data);
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error);
    } finally {
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
        description: 'Digite seu numero de WhatsApp',
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
        throw new Error(data.error || 'Erro ao registrar numero');
      }

      toast({
        title: 'Codigo enviado',
        description: 'Verifique seu WhatsApp para o codigo de verificacao',
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
        description: 'Digite o codigo de 6 digitos',
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
        throw new Error(data.error || 'Codigo invalido');
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
        throw new Error(data.error || 'Erro ao reenviar codigo');
      }

      toast({
        title: 'Codigo reenviado',
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
        description: 'Voce pode conectar novamente a qualquer momento',
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
    return (
      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <i className="bxl bx-whatsapp text-green-500 text-2xl"></i>
            WhatsApp
          </CardTitle>
          <CardDescription>
            Gerencie suas transacoes por mensagens de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-yellow-600">
            <i className="bx bx-info-circle"></i>
            <span>
              {status?.message || 'Esta integracao sera disponibilizada em breve'}
            </span>
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
            Gerencie suas transacoes por mensagens de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
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
              <li>- Envie mensagens de texto ou audio</li>
              <li>- Ex: &quot;Gastei 50 reais no mercado&quot;</li>
              <li>- Ex: &quot;Recebi 1000 de salario&quot;</li>
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
              Verificacao Pendente
            </span>
          </CardTitle>
          <CardDescription>
            Digite o codigo de 6 digitos enviado para {status?.phoneNumber}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verification_code">Codigo de Verificacao</Label>
            <div className="flex gap-2">
              <Input
                id="verification_code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="max-w-[150px] text-center text-2xl tracking-widest"
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

          <div className="flex items-center gap-2">
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
                  Reenviar codigo
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
              Usar outro numero
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
          Conecte seu WhatsApp para gerenciar transacoes por mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone_number">Numero do WhatsApp</Label>
          <div className="flex gap-2">
            <Input
              id="phone_number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+5511999999999"
              className="max-w-[200px]"
            />
            <Button onClick={handleRegister} disabled={submitting || !phoneNumber}>
              {submitting ? (
                <i className="bx bx-loader-alt bx-spin mr-1"></i>
              ) : (
                <i className="bx bx-send mr-1"></i>
              )}
              Enviar Codigo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Voce recebera um codigo de verificacao no WhatsApp
          </p>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-2">Com esta integracao voce pode:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>- Registrar transacoes por mensagem de texto ou audio</li>
            <li>- Consultar saldos e resumos</li>
            <li>- Receber lembretes e alertas</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
