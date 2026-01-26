'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assetSchema } from '@/lib/validation/schemas';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useMembers } from '@/hooks/useMembers';

type AssetFormData = z.infer<typeof assetSchema>;

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface AssetFormProps {
  asset?: any;
  accounts?: Account[];
  categories?: Category[];
  onSubmit: (data: AssetFormData) => Promise<void>;
  onCancel?: () => void;
}

const assetTypes = [
  { value: 'real_estate', label: 'Imóvel', icon: '🏠' },
  { value: 'vehicle', label: 'Veículo', icon: '🚗' },
  { value: 'rights', label: 'Direitos', icon: '📜' },
  { value: 'equipment', label: 'Equipamento', icon: '⚙️' },
  { value: 'jewelry', label: 'Joia', icon: '💎' },
  { value: 'other', label: 'Outro', icon: '📦' },
];

const depreciationMethods = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'linear', label: 'Linear' },
  { value: 'declining_balance', label: 'Saldo Decrescente' },
];

export default function AssetForm({
  asset,
  accounts = [],
  categories = [],
  onSubmit,
  onCancel,
}: AssetFormProps) {
  const { toast } = useToast();
  const { members, loading: loadingMembers } = useMembers();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>(asset?.type || 'real_estate');
  const [createPurchaseTransaction, setCreatePurchaseTransaction] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>(asset?.assigned_to || '');

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    watch,
    reset,
  } = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: asset ? {
      name: asset.name || '',
      type: asset.type || 'real_estate',
      description: asset.description || '',
      purchase_date: asset.purchase_date || '',
      purchase_price_cents: (asset.purchase_price_cents || 0) / 100,
      current_value_cents: (asset.current_value_cents || asset.purchase_price_cents || 0) / 100,
      location: asset.location || '',
      license_plate: asset.license_plate || '',
      registration_number: asset.registration_number || '',
      insurance_company: asset.insurance_company || '',
      insurance_policy_number: asset.insurance_policy_number || '',
      insurance_expiry_date: asset.insurance_expiry_date || '',
      status: asset.status || 'active',
      sale_date: asset.sale_date || '',
      sale_price_cents: (asset.sale_price_cents || 0) / 100,
      depreciation_method: asset.depreciation_method || 'none',
      depreciation_rate: asset.depreciation_rate || 0,
      useful_life_years: asset.useful_life_years || 0,
      account_id: asset.account_id || '',
      category_id: asset.category_id || '',
      notes: asset.notes || '',
      assigned_to: asset.assigned_to || '',
    } : {
      type: 'real_estate',
      status: 'active',
      depreciation_method: 'none',
      current_value_cents: undefined,
      assigned_to: '',
    },
  });

  const watchedType = watch('type');
  const watchedStatus = watch('status');
  const watchedDepreciationMethod = watch('depreciation_method');

  useEffect(() => {
    if (watchedType) {
      setSelectedType(watchedType);
    }
  }, [watchedType]);


  const onFormSubmit = async (data: AssetFormData) => {
    try {
      setLoading(true);
      console.log('Form submitted with data:', data);
      console.log('Purchase price (raw):', data.purchase_price_cents);
      console.log('Current value (raw):', data.current_value_cents);
      console.log('Current value type:', typeof data.current_value_cents);
      console.log('Current value is null?', data.current_value_cents === null);
      console.log('Current value is undefined?', data.current_value_cents === undefined);
      
      // Remove undefined values from the data before submitting
      // BUT: always include current_value_cents if it exists in data (even if null/undefined)
      // to allow explicit updates or clearing
      const cleanedData: any = { ...data };
      
      // Explicitly ensure current_value_cents is included if it was in the original data
      if ('current_value_cents' in data) {
        cleanedData.current_value_cents = data.current_value_cents;
      }
      
      // Remove undefined values (except current_value_cents)
      for (const [key, value] of Object.entries(cleanedData)) {
        if (key !== 'current_value_cents' && value === undefined) {
          delete cleanedData[key];
        }
      }
      
      // Add assigned_to
      cleanedData.assigned_to = assignedTo || undefined;
      
      // Add create_purchase_transaction flag if creating new asset
      if (!asset && createPurchaseTransaction) {
        (cleanedData as any).create_purchase_transaction = true;
      }
      
      console.log('Cleaned data:', cleanedData);
      console.log('Cleaned data keys:', Object.keys(cleanedData));
      console.log('Purchase price (cleaned):', cleanedData.purchase_price_cents);
      console.log('Current value (cleaned):', cleanedData.current_value_cents);
      console.log('Current value in cleanedData?', 'current_value_cents' in cleanedData);
      console.log('Cleaned data JSON:', JSON.stringify(cleanedData));
      
      await onSubmit(cleanedData);
      if (!asset) {
        reset();
      }
    } catch (error: any) {
      console.error('Error in form submit:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar bem',
        variant: 'destructive',
      });
      // Re-throw to let react-hook-form handle it
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = handleSubmit(
    (data) => {
      console.log('✅ Form validation passed, submitting...', data);
      console.log('✅ Form data - current_value_cents:', data.current_value_cents);
      console.log('✅ Form data - has current_value_cents?', 'current_value_cents' in data);
      console.log('✅ Form data JSON:', JSON.stringify(data));
      return onFormSubmit(data);
    },
    (errors) => {
      console.error('❌ Form validation errors:', errors);
      console.error('Form errors object:', JSON.stringify(errors, null, 2));
      const firstError = Object.values(errors)[0];
      toast({
        title: 'Erro de validação',
        description: firstError?.message || 'Por favor, corrija os erros no formulário',
        variant: 'destructive',
      });
    }
  );

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* Nome */}
      <div>
        <Label htmlFor="name">Nome do Bem *</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Ex: Apartamento Centro, Carro Corolla 2020"
        />
        {errors.name && (
          <p className="text-sm text-negative mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Tipo */}
      <div>
        <Label htmlFor="type">Tipo *</Label>
        <Select
          value={watch('type')}
          onValueChange={(value) => setValue('type', value as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            {assetTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.icon} {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-sm text-negative mt-1">{errors.type.message}</p>
        )}
      </div>

      {/* Descrição */}
      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Descrição detalhada do bem"
          rows={3}
        />
      </div>

      {/* Data de Compra */}
      <div>
        <Label htmlFor="purchase_date">Data de Compra *</Label>
        <DatePicker
          date={watch('purchase_date') ? new Date(watch('purchase_date')) : undefined}
          setDate={(date) => {
            if (date) {
              setValue('purchase_date', format(date, 'yyyy-MM-dd'), { shouldValidate: true });
            } else {
              setValue('purchase_date', '', { shouldValidate: true });
            }
          }}
          placeholder="Selecione a data de compra"
        />
        {errors.purchase_date && (
          <p className="text-sm text-negative mt-1">{errors.purchase_date.message}</p>
        )}
      </div>

      {/* Valor de Compra */}
      <div>
        <Label htmlFor="purchase_price_cents">Valor de Compra *</Label>
        <Controller
          name="purchase_price_cents"
          control={control}
          render={({ field }) => (
            <CurrencyInput
              id="purchase_price_cents"
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
              }}
              convertToCents={false}
              allowEmpty={false}
              placeholder="0,00"
            />
          )}
        />
        {errors.purchase_price_cents && (
          <p className="text-sm text-negative mt-1">{errors.purchase_price_cents.message}</p>
        )}
      </div>

      {/* Valor Atual */}
      <div>
        <Label htmlFor="current_value_cents">Valor Atual (opcional)</Label>
        <Controller
          name="current_value_cents"
          control={control}
          render={({ field }) => (
            <CurrencyInput
              id="current_value_cents"
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
              }}
              convertToCents={false}
              allowEmpty={true}
              placeholder="Deixe em branco para usar valor de compra"
            />
          )}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Se não preenchido, será usado o valor de compra
        </p>
      </div>

      {/* Campos específicos por tipo */}
      {selectedType === 'real_estate' && (
        <div>
          <Label htmlFor="location">Localização/Endereço</Label>
          <Input
            id="location"
            {...register('location')}
            placeholder="Ex: Rua das Flores, 123 - São Paulo, SP"
          />
        </div>
      )}

      {selectedType === 'vehicle' && (
        <>
          <div>
            <Label htmlFor="license_plate">Placa</Label>
            <Input
              id="license_plate"
              {...register('license_plate')}
              placeholder="ABC-1234"
            />
          </div>
        </>
      )}

      {/* Número de Registro (para todos os tipos) */}
      <div>
        <Label htmlFor="registration_number">Número de Registro/Documento</Label>
        <Input
          id="registration_number"
          {...register('registration_number')}
          placeholder="Ex: Matrícula, Chassi, etc."
        />
      </div>

      {/* Seguro */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="font-semibold">Informações de Seguro</h3>
        <div>
          <Label htmlFor="insurance_company">Seguradora</Label>
          <Input
            id="insurance_company"
            {...register('insurance_company')}
            placeholder="Nome da seguradora"
          />
        </div>
        <div>
          <Label htmlFor="insurance_policy_number">Número da Apólice</Label>
          <Input
            id="insurance_policy_number"
            {...register('insurance_policy_number')}
            placeholder="Número da apólice"
          />
        </div>
        <div>
          <Label htmlFor="insurance_expiry_date">Vencimento do Seguro</Label>
          <DatePicker
            date={watch('insurance_expiry_date') ? new Date(watch('insurance_expiry_date') as string) : undefined}
            setDate={(date) => {
              if (date) {
                setValue('insurance_expiry_date', format(date, 'yyyy-MM-dd'));
              } else {
                setValue('insurance_expiry_date', '');
              }
            }}
            placeholder="Selecione a data de vencimento"
          />
        </div>
      </div>

      {/* Depreciação */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="font-semibold">Depreciação</h3>
        <div>
          <Label htmlFor="depreciation_method">Método de Depreciação</Label>
          <Select
            value={watchedDepreciationMethod || 'none'}
            onValueChange={(value) => setValue('depreciation_method', value as any)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {depreciationMethods.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {watchedDepreciationMethod !== 'none' && (
          <>
            <div>
              <Label htmlFor="depreciation_rate">Taxa de Depreciação Anual (%)</Label>
              <Input
                id="depreciation_rate"
                type="number"
                step="0.1"
                {...register('depreciation_rate', {
                  valueAsNumber: true,
                })}
                placeholder="Ex: 10"
              />
            </div>
            <div>
              <Label htmlFor="useful_life_years">Vida Útil (anos)</Label>
              <Input
                id="useful_life_years"
                type="number"
                {...register('useful_life_years', {
                  valueAsNumber: true,
                })}
                placeholder="Ex: 10"
              />
            </div>
          </>
        )}
      </div>

      {/* Status */}
      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          value={watchedStatus || 'active'}
          onValueChange={(value) => setValue('status', value as any)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="sold">Vendido</SelectItem>
            <SelectItem value="disposed">Descartado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campos de venda (se status = sold) */}
      {watchedStatus === 'sold' && (
        <>
          <div>
            <Label htmlFor="sale_date">Data de Venda *</Label>
            <DatePicker
              date={watch('sale_date') ? new Date(watch('sale_date') as string) : undefined}
              setDate={(date) => {
                if (date) {
                  setValue('sale_date', format(date, 'yyyy-MM-dd'), { shouldValidate: true });
                } else {
                  setValue('sale_date', '', { shouldValidate: true });
                }
              }}
              placeholder="Selecione a data de venda"
            />
            {errors.sale_date && (
              <p className="text-sm text-negative mt-1">{errors.sale_date.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="sale_price_cents">Valor de Venda *</Label>
            <Controller
              name="sale_price_cents"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  id="sale_price_cents"
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                  }}
                  convertToCents={false}
                  allowEmpty={false}
                  placeholder="0,00"
                />
              )}
            />
            {errors.sale_price_cents && (
              <p className="text-sm text-negative mt-1">{errors.sale_price_cents.message}</p>
            )}
          </div>
        </>
      )}

      {/* Conta e Categoria */}
      {accounts.length > 0 && (
        <div>
          <Label htmlFor="account_id">Conta Relacionada</Label>
          <Select
            value={watch('account_id') || undefined}
            onValueChange={(value) => setValue('account_id', value === 'none' ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma conta (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {categories.length > 0 && (
        <div>
          <Label htmlFor="category_id">Categoria</Label>
          <Select
            value={watch('category_id') || undefined}
            onValueChange={(value) => setValue('category_id', value === 'none' ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma categoria (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Observações */}
      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Observações adicionais"
          rows={3}
        />
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
            Quem é responsável por este bem?
          </p>
        </div>
      )}

      {/* Criar transação de compra (apenas para novos assets) */}
      {!asset && (
        <div className="flex items-center gap-3">
          <Checkbox
            id="create_purchase_transaction"
            checked={createPurchaseTransaction}
            onCheckedChange={(checked) => setCreatePurchaseTransaction(checked === true)}
          />
          <Label htmlFor="create_purchase_transaction" className="text-sm font-medium cursor-pointer">
            Criar transação de compra automaticamente
          </Label>
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button 
          type="submit" 
          disabled={loading}
        >
          {loading ? 'Salvando...' : asset ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
}

