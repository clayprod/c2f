'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UserPlanInfo {
  id: string;
  email: string;
  full_name: string | null;
  plan: 'free' | 'pro' | 'premium';
  stripe_subscription_id: string | null;
  is_manual: boolean;
}

interface RevokePlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserPlanInfo;
  onSuccess: () => void;
}

export default function RevokePlanModal({
  open,
  onOpenChange,
  user,
  onSuccess,
}: RevokePlanModalProps) {
  const [cancelStripe, setCancelStripe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasStripeSubscription = !!user.stripe_subscription_id;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${user.id}/revoke-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancel_stripe_subscription: cancelStripe,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao revogar plano');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao revogar plano');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Revogar Plano</DialogTitle>
          <DialogDescription>
            Revogar plano {user.plan.toUpperCase()} de {user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium">Informações do Usuário</p>
            <p className="text-sm text-muted-foreground">
              Email: <span className="font-medium">{user.email}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Plano Atual: <span className="font-medium">{user.plan.toUpperCase()}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Tipo: <span className="font-medium">{user.is_manual ? 'Manual' : 'Pago'}</span>
            </p>
          </div>

          {hasStripeSubscription && (
            <Alert>
              <AlertDescription>
                Este usuário possui uma subscription ativa no Stripe. 
                Se você marcar a opção abaixo, a subscription será cancelada no Stripe também.
              </AlertDescription>
            </Alert>
          )}

          {hasStripeSubscription && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cancel-stripe"
                checked={cancelStripe}
                onCheckedChange={(checked) => setCancelStripe(checked === true)}
              />
              <Label
                htmlFor="cancel-stripe"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Cancelar também subscription no Stripe
              </Label>
            </div>
          )}

          {!hasStripeSubscription && user.is_manual && (
            <Alert>
              <AlertDescription>
                Este é um plano manual sem subscription no Stripe. 
                Apenas o registro no banco de dados será removido.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Revogando...' : 'Revogar Plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
