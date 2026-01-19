'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import PermissionsEditor, { type Permissions } from './PermissionsEditor';

const inviteSchema = z.object({
  email: z.string().email('Email invalido'),
  role: z.enum(['viewer', 'editor', 'admin']),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const DEFAULT_PERMISSIONS: Permissions = {
  dashboard: true,
  transactions: { view: true, create: false, edit: false, delete: false },
  budgets: { view: true, edit: false },
  goals: { view: true, edit: false },
  debts: { view: true, edit: false },
  investments: { view: true, edit: false },
  assets: { view: true, edit: false },
  reports: true,
  settings: false,
  integrations: false,
};

const ROLE_PRESETS: Record<string, Permissions> = {
  viewer: DEFAULT_PERMISSIONS,
  editor: {
    dashboard: true,
    transactions: { view: true, create: true, edit: true, delete: false },
    budgets: { view: true, edit: true },
    goals: { view: true, edit: false },
    debts: { view: true, edit: false },
    investments: { view: true, edit: false },
    assets: { view: true, edit: false },
    reports: true,
    settings: false,
    integrations: false,
  },
  admin: {
    dashboard: true,
    transactions: { view: true, create: true, edit: true, delete: true },
    budgets: { view: true, edit: true },
    goals: { view: true, edit: true },
    debts: { view: true, edit: true },
    investments: { view: true, edit: true },
    assets: { view: true, edit: true },
    reports: true,
    settings: false,
    integrations: false,
  },
};

export default function InviteMemberModal({
  open,
  onOpenChange,
  onSuccess,
}: InviteMemberModalProps) {
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'viewer',
    },
  });

  const role = watch('role');

  const handleRoleChange = (newRole: 'viewer' | 'editor' | 'admin') => {
    setValue('role', newRole);
    setPermissions(ROLE_PRESETS[newRole]);
  };

  const onSubmit = async (data: InviteFormData) => {
    try {
      setLoading(true);

      const res = await fetch('/api/sharing/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          role: data.role,
          permissions: showAdvanced ? permissions : undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        // If invite was created but email failed, show warning with invite link
        if (result.invite && result.inviteLink) {
          const errorMsg = result.error || 'Erro ao enviar email';
          const detailsMsg = result.details ? `\n\nDetalhes: ${result.details}` : '';
          const linkMsg = `\n\nLink do convite (copie e compartilhe manualmente):\n${result.inviteLink}`;
          
          toast({
            variant: 'destructive',
            title: 'Convite criado, mas email nao foi enviado',
            description: `${errorMsg}${detailsMsg}${linkMsg}`,
            duration: 15000,
          });
          
          // Copy link to clipboard if possible
          if (navigator.clipboard) {
            navigator.clipboard.writeText(result.inviteLink).catch(() => {
              // Ignore clipboard errors
            });
          }
          
          // Still call onSuccess to refresh the list
          onSuccess();
          onOpenChange(false);
          return;
        }
        throw new Error(result.error || result.details || 'Erro ao enviar convite');
      }

      toast({
        title: 'Convite enviado',
        description: `Um email foi enviado para ${data.email}`,
      });

      reset();
      setPermissions(DEFAULT_PERMISSIONS);
      setShowAdvanced(false);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar convite',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="bx bx-user-plus text-xl text-primary"></i>
            Convidar Membro
          </DialogTitle>
          <DialogDescription>
            Convide alguem para acessar sua conta financeira
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder="email@exemplo.com"
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label>Nivel de Acesso</Label>
            <Select value={role} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">
                  <div className="flex items-center gap-2">
                    <i className="bx bx-show text-muted-foreground"></i>
                    <div>
                      <span className="font-medium">Visualizador</span>
                      <p className="text-xs text-muted-foreground">
                        Apenas visualiza dados
                      </p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="editor">
                  <div className="flex items-center gap-2">
                    <i className="bx bx-edit text-muted-foreground"></i>
                    <div>
                      <span className="font-medium">Editor</span>
                      <p className="text-xs text-muted-foreground">
                        Pode criar e editar transacoes
                      </p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <i className="bx bx-shield text-muted-foreground"></i>
                    <div>
                      <span className="font-medium">Administrador</span>
                      <p className="text-xs text-muted-foreground">
                        Acesso total (exceto configuracoes)
                      </p>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <i className={`bx ${showAdvanced ? 'bx-chevron-up' : 'bx-chevron-down'}`}></i>
              Permissoes avancadas
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 bg-muted/30 rounded-lg">
                <PermissionsEditor
                  permissions={permissions}
                  onChange={setPermissions}
                />
              </div>
            )}
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
            <p className="flex items-center gap-2 text-blue-500">
              <i className="bx bx-info-circle"></i>
              <strong>Como funciona:</strong>
            </p>
            <p className="text-muted-foreground mt-1">
              Um email sera enviado para o convidado. Se ele ja tiver conta, podera
              aceitar o convite. Caso contrario, podera criar uma conta.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <i className="bx bx-loader-alt bx-spin mr-2"></i>
                  Enviando...
                </>
              ) : (
                <>
                  <i className="bx bx-send mr-2"></i>
                  Enviar Convite
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
