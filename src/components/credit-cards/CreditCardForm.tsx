'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { useToast } from '@/hooks/use-toast';
import { useMembers } from '@/hooks/useMembers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreditCard {
  id: string;
  name: string;
  institution: string | null;
  last_four_digits: string | null;
  card_brand: string | null;
  credit_limit_cents: number;
  closing_day: number;
  due_day: number;
  expiration_date: string | null;
  interest_rate_monthly: number;
  interest_rate_annual: number;
  color: string;
  icon: string;
  is_default: boolean;
}

interface CardBrand {
  value: string;
  label: string;
  icon: string;
}

interface CreditCardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: CreditCard | null;
  onSuccess: () => void;
  cardBrands: CardBrand[];
  cardColors: string[];
}

// Fixed icon for all credit cards
const CARD_ICON = '💳';

export default function CreditCardForm({
  open,
  onOpenChange,
  card,
  onSuccess,
  cardBrands,
  cardColors,
}: CreditCardFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    institution: '',
    last_four_digits: '',
    card_brand: 'visa',
    credit_limit: '',
    closing_day: '10',
    due_day: '15',
    expiration_date: '', // Stored as YYYY-MM-DD (last day of month) for DB
    expiration_month: '', // Display format YYYY-MM for month input
    interest_rate_monthly: '',
    interest_rate_annual: '',
    color: '#1a1a2e',
    is_default: false,
  });
  const { toast } = useToast();
  const { members, loading: loadingMembers } = useMembers();
  const [assignedTo, setAssignedTo] = useState<string>('');

  useEffect(() => {
    if (card) {
      // Convert expiration_date to month format (YYYY-MM) for month input
      let expirationMonth = '';
      if (card.expiration_date) {
        const date = new Date(card.expiration_date);
        expirationMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      setFormData({
        name: card.name,
        institution: card.institution || '',
        last_four_digits: card.last_four_digits || '',
        card_brand: card.card_brand || 'visa',
        credit_limit: (card.credit_limit_cents / 100).toFixed(2),
        closing_day: String(card.closing_day),
        due_day: String(card.due_day),
        expiration_date: card.expiration_date || '',
        expiration_month: expirationMonth,
        interest_rate_monthly: card.interest_rate_monthly ? String(card.interest_rate_monthly) : '',
        interest_rate_annual: card.interest_rate_annual ? String(card.interest_rate_annual) : '',
        color: card.color || '#1a1a2e',
        is_default: card.is_default,
      });
    } else {
      setFormData({
        name: '',
        institution: '',
        last_four_digits: '',
        card_brand: 'visa',
        credit_limit: '',
        closing_day: '10',
        due_day: '15',
        expiration_date: '',
        expiration_month: '',
        interest_rate_monthly: '',
        interest_rate_annual: '',
        color: '#1a1a2e',
        is_default: false,
      });
      setAssignedTo('');
    }
  }, [card, open]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome do cartão é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.credit_limit || parseFloat(formData.credit_limit) <= 0) {
      toast({
        title: 'Erro',
        description: 'Limite de crédito é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    const closingDay = parseInt(formData.closing_day);
    const dueDay = parseInt(formData.due_day);

    if (closingDay < 1 || closingDay > 31) {
      toast({
        title: 'Erro',
        description: 'Dia de fechamento deve ser entre 1 e 31',
        variant: 'destructive',
      });
      return;
    }

    if (dueDay < 1 || dueDay > 31) {
      toast({
        title: 'Erro',
        description: 'Dia de vencimento deve ser entre 1 e 31',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const url = card
        ? `/api/credit-cards/${card.id}`
        : '/api/credit-cards';
      const method = card ? 'PATCH' : 'POST';

      // Convert expiration_month (YYYY-MM) to expiration_date (YYYY-MM-DD, last day of month)
      let expirationDate = '';
      if (formData.expiration_month) {
        const [year, month] = formData.expiration_month.split('-');
        // Get last day of the month
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        expirationDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      }

      const payload = {
        name: formData.name.trim(),
        institution: formData.institution.trim() || null,
        last_four_digits: formData.last_four_digits || null,
        card_brand: formData.card_brand,
        credit_limit_cents: Math.round(parseFloat(formData.credit_limit) * 100),
        closing_day: closingDay,
        due_day: dueDay,
        expiration_date: expirationDate || '',
        interest_rate_monthly: formData.interest_rate_monthly ? parseFloat(formData.interest_rate_monthly) : 0,
        interest_rate_annual: formData.interest_rate_annual ? parseFloat(formData.interest_rate_annual) : 0,
        color: formData.color,
        is_default: formData.is_default,
        assigned_to: assignedTo || undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao salvar cartão');
      }

      toast({
        title: 'Sucesso',
        description: card ? 'Cartão atualizado' : 'Cartão criado',
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{card ? 'Editar Cartão' : 'Novo Cartão de Crédito'}</DialogTitle>
          <DialogDescription>
            {card ? 'Modifique os dados do cartão' : 'Adicione um novo cartão de crédito'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="name">Nome do Cartão *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Nubank, Itau..."
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="institution">Instituicao</Label>
              <Input
                id="institution"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                placeholder="Ex: Nubank, Banco do Brasil..."
              />
            </div>
          </div>

          {/* Card Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="last_four_digits">Ultimos 4 digitos</Label>
              <Input
                id="last_four_digits"
                value={formData.last_four_digits}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setFormData({ ...formData, last_four_digits: value });
                }}
                placeholder="1234"
                maxLength={4}
              />
            </div>
            <div>
              <Label htmlFor="card_brand">Bandeira</Label>
              <select
                id="card_brand"
                value={formData.card_brand}
                onChange={(e) => setFormData({ ...formData, card_brand: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-input bg-background"
              >
                {cardBrands.map((brand) => (
                  <option key={brand.value} value={brand.value}>
                    {brand.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Limit */}
          <div>
            <Label htmlFor="credit_limit">Limite de Credito (R$) *</Label>
            <Input
              id="credit_limit"
              type="number"
              step="0.01"
              min="0"
              value={formData.credit_limit}
              onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
              placeholder="5000,00"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="closing_day">Dia de Fechamento *</Label>
              <Input
                id="closing_day"
                type="number"
                min="1"
                max="31"
                value={formData.closing_day}
                onChange={(e) => setFormData({ ...formData, closing_day: e.target.value })}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dia do mês em que a fatura fecha
              </p>
            </div>
            <div>
              <Label htmlFor="due_day">Dia de Vencimento da Fatura *</Label>
              <Input
                id="due_day"
                type="number"
                min="1"
                max="31"
                value={formData.due_day}
                onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                placeholder="15"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dia do mês para pagamento da fatura
              </p>
            </div>
          </div>

          {/* Card Expiration Date */}
          <div>
            <Label htmlFor="expiration_month">Data de Expiração</Label>
            <MonthYearPicker
              value={formData.expiration_month || ''}
              onChange={(value) => {
                setFormData({ ...formData, expiration_month: value });
              }}
              placeholder="Selecione o mês de expiração"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Mês e ano de expiração do cartão físico (MM/AA no cartão)
            </p>
          </div>

          {/* Interest Rates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="interest_rate_monthly">Juros Mensal (%)</Label>
              <Input
                id="interest_rate_monthly"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.interest_rate_monthly}
                onChange={(e) => setFormData({ ...formData, interest_rate_monthly: e.target.value })}
                placeholder="14,99"
              />
            </div>
            <div>
              <Label htmlFor="interest_rate_annual">Juros Anual (%)</Label>
              <Input
                id="interest_rate_annual"
                type="number"
                step="0.01"
                min="0"
                max="1000"
                value={formData.interest_rate_annual}
                onChange={(e) => setFormData({ ...formData, interest_rate_annual: e.target.value })}
                placeholder="435,93"
              />
            </div>
          </div>

          {/* Customization */}
          <div className="space-y-4">
            <div>
              <Label>Cor do Cartão</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {cardColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

          </div>

          {/* Preview */}
          <div>
            <Label>Preview do Cartão</Label>
            <div
              className="mt-2 p-4 rounded-xl text-white relative overflow-hidden"
              style={{ backgroundColor: formData.color }}
            >
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white -translate-y-1/2 translate-x-1/2" />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-white/70 text-xs">{formData.institution || 'Instituicao'}</p>
                    <p className="font-bold">{formData.name || 'Nome do Cartão'}</p>
                  </div>
                  <span className="text-2xl">{CARD_ICON}</span>
                </div>
                <div className="flex justify-between items-end">
                  <p className="tracking-widest text-sm">
                    **** **** **** {formData.last_four_digits || '0000'}
                  </p>
                  {(() => {
                    const selectedBrand = cardBrands.find(brand => brand.value === formData.card_brand);
                    return selectedBrand ? (
                      <p className="text-white/90 text-xs font-medium uppercase tracking-wider">
                        {selectedBrand.label}
                      </p>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Responsible Person */}
          {members.length > 1 && (
            <div>
              <Label htmlFor="assigned_to">Responsável</Label>
              <Select
                value={assignedTo}
                onValueChange={setAssignedTo}
                disabled={loadingMembers}
              >
                <SelectTrigger id="assigned_to" className="w-full">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.fullName || 'Avatar'}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                            {(member.fullName || member.email)[0].toUpperCase()}
                          </div>
                        )}
                        <span>{member.fullName || member.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Quem é responsável por este cartão?
              </p>
            </div>
          )}

          {/* Default Option */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="is_default"
              checked={formData.is_default}
              onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked === true })}
            />
            <Label htmlFor="is_default" className="cursor-pointer text-sm font-normal">
              Definir como cartão padrão
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : card ? 'Atualizar' : 'Criar Cartão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
