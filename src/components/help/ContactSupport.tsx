'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SupportContacts {
  email?: string | null;
  whatsapp?: string | null;
}

export function ContactSupport() {
  const [contacts, setContacts] = useState<SupportContacts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
    // Refresh every 30 seconds to get updated contacts
    const interval = setInterval(() => {
      fetchContacts();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchContacts = async () => {
    try {
      setError(null);
      // Add timestamp to prevent caching
      const res = await fetch(`/api/help/contacts?t=${Date.now()}`, {
        cache: 'no-store',
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('[ContactSupport] Received contacts:', data);
        setContacts(data);
      } else {
        console.error('[ContactSupport] Failed to fetch contacts:', res.status);
        setError('Não foi possível carregar os contatos');
      }
    } catch (error) {
      console.error('[ContactSupport] Error fetching support contacts:', error);
      setError('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailClick = () => {
    if (contacts.email) {
      window.location.href = `mailto:${contacts.email}`;
    }
  };

  const handleWhatsAppClick = () => {
    if (contacts.whatsapp) {
      // Remove qualquer formatação do número
      const cleanNumber = contacts.whatsapp.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanNumber}`, '_blank');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <i className="bx bx-loader-alt bx-spin text-2xl text-muted-foreground"></i>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasContacts = contacts.email || contacts.whatsapp;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <i className="bx bx-support text-xl text-primary"></i>
          Precisa de mais ajuda?
        </CardTitle>
        <CardDescription>
          Entre em contato com nosso suporte
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center py-4">
            <i className="bx bx-error-circle text-3xl text-destructive mb-2"></i>
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button onClick={fetchContacts} variant="outline" size="sm">
              <i className="bx bx-repeat mr-2"></i>
              Tentar novamente
            </Button>
          </div>
        ) : hasContacts ? (
          <div className="space-y-3">
            {contacts.email && (
              <Button
                onClick={handleEmailClick}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
              >
                <i className="bx bx-envelope text-xl"></i>
                <div className="text-left flex-1">
                  <div className="font-medium">Email</div>
                  <div className="text-sm text-muted-foreground">{contacts.email}</div>
                </div>
              </Button>
            )}
            {contacts.whatsapp && (
              <Button
                onClick={handleWhatsAppClick}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3 border-success/50 hover:bg-success/10"
              >
                <i className="bxl bx-whatsapp text-xl text-success"></i>
                <div className="text-left flex-1">
                  <div className="font-medium">WhatsApp</div>
                  <div className="text-sm text-muted-foreground">{contacts.whatsapp}</div>
                </div>
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <i className="bx bx-info-circle text-3xl text-muted-foreground mb-2"></i>
            <p className="text-sm text-muted-foreground mb-3">
              Os contatos de suporte ainda não foram configurados.
            </p>
            <Button onClick={fetchContacts} variant="outline" size="sm">
              <i className="bx bx-repeat mr-2"></i>
              Verificar novamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
