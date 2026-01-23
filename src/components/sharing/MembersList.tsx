'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import PermissionsEditor, { type Permissions } from './PermissionsEditor';

interface Member {
  id: string;
  member_id: string;
  role: string;
  permissions: Permissions;
  created_at: string;
  profiles: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  permissions: Permissions;
  status: string;
  expires_at: string;
  created_at: string;
}

interface SharedAccount {
  id: string;
  owner_id: string;
  role: string;
  permissions: Permissions;
  profiles: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

interface MembersListProps {
  members: Member[];
  invites: Invite[];
  sharedAccounts: SharedAccount[];
  onRefresh: () => void;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  viewer: { label: 'Visualizador', color: 'bg-muted text-muted-foreground' },
  editor: { label: 'Editor', color: 'bg-blue-500/10 text-blue-500' },
  admin: { label: 'Administrador', color: 'bg-amber-500/10 text-amber-500' },
};

export default function MembersList({
  members,
  invites,
  sharedAccounts,
  onRefresh,
}: MembersListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editRole, setEditRole] = useState<string>('viewer');
  const [editPermissions, setEditPermissions] = useState<Permissions | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const switchToAccount = (ownerId: string) => {
    try {
      localStorage.setItem('c2f_active_account', ownerId);
    } catch {
      // ignore
    }
    document.cookie = `c2f_active_account=${encodeURIComponent(ownerId)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    window.location.reload();
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/sharing/members?memberId=${memberId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Erro ao remover membro');
      }

      toast({
        title: 'Membro removido',
        description: 'O acesso foi revogado com sucesso',
      });

      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: 'destructive',
        title: 'Erro ao remover membro',
        description: message,
      });
    } finally {
      setRemovingId(null);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/sharing/invites?id=${inviteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Erro ao cancelar convite');
      }

      toast({
        title: 'Convite cancelado',
        description: 'O convite foi cancelado com sucesso',
      });

      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar convite',
        description: message,
      });
    } finally {
      setCancellingId(null);
    }
  };

  const handleLeaveAccount = async (ownerId: string) => {
    try {
      const res = await fetch(`/api/sharing/members?ownerId=${ownerId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Erro ao sair da conta');
      }

      toast({
        title: 'Acesso removido',
        description: 'Você não tem mais acesso a esta conta',
      });

      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: 'destructive',
        title: 'Erro ao sair da conta',
        description: message,
      });
    } finally {
      setLeavingId(null);
    }
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setEditRole(member.role);
    setEditPermissions(member.permissions);
  };

  const handleSaveEdit = async () => {
    if (!editingMember || !editPermissions) return;

    try {
      setSaving(true);

      const res = await fetch('/api/sharing/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: editingMember.member_id,
          role: editRole,
          permissions: editPermissions,
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Erro ao atualizar permissoes');
      }

      toast({
        title: 'Permissoes atualizadas',
        description: 'As permissoes foram atualizadas com sucesso',
      });

      setEditingMember(null);
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar permissoes',
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Active Members */}
      <div>
        <h3 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
          <i className="bx bx-group"></i>
          Membros Ativos ({members.length})
        </h3>

        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-lg">
            Nenhum membro compartilhado ainda
          </p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {member.profiles?.avatar_url ? (
                    <img
                      src={member.profiles.avatar_url}
                      alt={member.profiles.full_name || 'Avatar'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                      {getInitials(member.profiles?.full_name || null, member.profiles?.email || '??')}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">
                      {member.profiles?.full_name || member.profiles?.email || 'Usuário'}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.profiles?.email || ''}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ROLE_LABELS[member.role]?.color || ROLE_LABELS.viewer.color
                    }`}
                  >
                    {ROLE_LABELS[member.role]?.label || member.role}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditMember(member)}
                  >
                    <i className="bx bx-edit"></i>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setRemovingId(member.member_id)}
                  >
                    <i className="bx bx-trash"></i>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div>
          <h3 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
            <i className="bx bx-time"></i>
            Convites Pendentes ({invites.length})
          </h3>

          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <i className="bx bx-envelope text-yellow-500"></i>
                  </div>
                  <div>
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expira em {formatDate(invite.expires_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ROLE_LABELS[invite.role]?.color || ROLE_LABELS.viewer.color
                    }`}
                  >
                    {ROLE_LABELS[invite.role]?.label || invite.role}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setCancellingId(invite.id)}
                  >
                    <i className="bx bx-x"></i>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shared Accounts (accounts I have access to) */}
      {sharedAccounts.length > 0 && (
        <div>
          <h3 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
            <i className="bx bx-share-alt"></i>
            Contas Compartilhadas Comigo ({sharedAccounts.length})
          </h3>

          <div className="space-y-2">
            {sharedAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => switchToAccount(account.owner_id)}
                title="Clique para alternar para esta conta"
              >
                <div className="flex items-center gap-3">
                  {account.profiles?.avatar_url ? (
                    <img
                      src={account.profiles.avatar_url}
                      alt={account.profiles.full_name || 'Avatar'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                      {getInitials(account.profiles?.full_name || null, account.profiles?.email || '??')}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">
                      {account.profiles?.full_name || account.profiles?.email || 'Conta'}
                    </p>
                    <p className="text-xs text-muted-foreground">{account.profiles?.email || ''}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ROLE_LABELS[account.role]?.color || ROLE_LABELS.viewer.color
                    }`}
                  >
                    {ROLE_LABELS[account.role]?.label || account.role}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLeavingId(account.owner_id);
                    }}
                  >
                    <i className="bx bx-log-out"></i>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removingId} onOpenChange={() => setRemovingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o acesso deste membro? Ele não poderá mais
              visualizar ou editar seus dados financeiros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removingId && handleRemoveMember(removingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Invite Confirmation */}
      <AlertDialog open={!!cancellingId} onOpenChange={() => setCancellingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Convite</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este convite?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancellingId && handleCancelInvite(cancellingId)}
            >
              Cancelar Convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Account Confirmation */}
      <AlertDialog open={!!leavingId} onOpenChange={() => setLeavingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da Conta Compartilhada</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja sair desta conta compartilhada? Voce perdera o
              acesso aos dados financeiros desta conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leavingId && handleLeaveAccount(leavingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Member Dialog */}
      <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Permissoes</DialogTitle>
          </DialogHeader>

          {editingMember && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                {editingMember.profiles?.avatar_url ? (
                  <img
                    src={editingMember.profiles.avatar_url}
                    alt={editingMember.profiles.full_name || 'Avatar'}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    {getInitials(
                      editingMember.profiles?.full_name || null,
                      editingMember.profiles?.email || '??'
                    )}
                  </div>
                )}
                <div>
                  <p className="font-medium">
                    {editingMember.profiles?.full_name || editingMember.profiles?.email || 'Usuário'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {editingMember.profiles?.email || ''}
                  </p>
                </div>
              </div>

              <div>
                <Label>Nivel de Acesso</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Permissoes Detalhadas</Label>
                <div className="mt-2 p-3 bg-muted/30 rounded-lg">
                  {editPermissions && (
                    <PermissionsEditor
                      permissions={editPermissions}
                      onChange={setEditPermissions}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
