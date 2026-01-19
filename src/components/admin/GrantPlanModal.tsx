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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UserPlanInfo {
  id: string;
  email: string;
  full_name: string | null;
  plan: 'free' | 'pro' | 'premium';
}

interface GrantPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserPlanInfo;
  onSuccess: () => void;
}

export default function GrantPlanModal({
  open,
  onOpenChange,
  user,
  onSuccess,
}: GrantPlanModalProps) {
  const [plan, setPlan] = useState<'pro' | 'premium'>('pro');
  const [periodType, setPeriodType] = useState<'preset' | 'custom'>('preset');
  const [presetMonths, setPresetMonths] = useState<number>(1);
  const [customMonths, setCustomMonths] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodMonths = periodType === 'preset' ? presetMonths : customMonths;

  const calculateExpirationDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + periodMonths);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleSubmit = async () => {
    if (periodMonths < 1 || periodMonths > 120) {
      setError('Período deve ser entre 1 e 120 meses');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${user.id}/grant-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          period_months: periodMonths,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao conceder plano');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao conceder plano');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Conceder Plano</DialogTitle>
          <DialogDescription>
            Conceder plano premium ou pro para {user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="plan">Plano</Label>
            <Select value={plan} onValueChange={(value) => setPlan(value as 'pro' | 'premium')}>
              <SelectTrigger id="plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Período</Label>
            <Select
              value={periodType}
              onValueChange={(value) => setPeriodType(value as 'preset' | 'custom')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preset">Período Predefinido</SelectItem>
                <SelectItem value="custom">Período Customizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {periodType === 'preset' ? (
            <div className="space-y-2">
              <Label htmlFor="preset-months">Período</Label>
              <Select
                value={presetMonths.toString()}
                onValueChange={(value) => setPresetMonths(parseInt(value, 10))}
              >
                <SelectTrigger id="preset-months">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mês</SelectItem>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="custom-months">Meses</Label>
              <Input
                id="custom-months"
                type="number"
                min="1"
                max="120"
                value={customMonths}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value) && value >= 1 && value <= 120) {
                    setCustomMonths(value);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Entre 1 e 120 meses
              </p>
            </div>
          )}

          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium">Preview</p>
            <p className="text-sm text-muted-foreground">
              Plano: <span className="font-medium">{plan.toUpperCase()}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Período: <span className="font-medium">{periodMonths} {periodMonths === 1 ? 'mês' : 'meses'}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Expira em: <span className="font-medium">{calculateExpirationDate()}</span>
            </p>
          </div>

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
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Concedendo...' : 'Conceder Plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
