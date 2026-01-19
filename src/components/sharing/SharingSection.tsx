'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import InviteMemberModal from './InviteMemberModal';
import MembersList from './MembersList';
import type { Permissions } from './PermissionsEditor';

interface Member {
  id: string;
  member_id: string;
  role: string;
  permissions: Permissions;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  profiles: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

export default function SharingSection() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccount[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [membersRes, invitesRes] = await Promise.all([
        fetch('/api/sharing/members'),
        fetch('/api/sharing/invites'),
      ]);

      const [membersData, invitesData] = await Promise.all([
        membersRes.json(),
        invitesRes.json(),
      ]);

      if (membersRes.ok && membersData.data) {
        setMembers(membersData.data.members || []);
        setSharedAccounts(membersData.data.sharedAccounts || []);
      }

      if (invitesRes.ok && invitesData.data) {
        setInvites(invitesData.data || []);
      }
    } catch (error) {
      console.error('Error fetching sharing data:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Nao foi possivel carregar os dados de compartilhamento',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground flex items-center gap-2">
          <i className="bx bx-loader-alt bx-spin"></i>
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-lg flex items-center gap-2">
            <i className="bx bx-share-alt text-xl text-primary"></i>
            Compartilhamento
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie quem tem acesso aos seus dados financeiros
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <i className="bx bx-user-plus mr-2"></i>
          Convidar
        </Button>
      </div>

      {/* Info Box */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-3">
          <i className="bx bx-info-circle text-primary text-xl flex-shrink-0"></i>
          <div className="text-sm">
            <p className="font-medium text-primary mb-1">Sobre o compartilhamento</p>
            <p className="text-muted-foreground">
              Ao compartilhar sua conta, outros usuarios poderao visualizar e/ou editar
              seus dados financeiros conforme as permissoes que voce definir. Voce pode
              remover o acesso a qualquer momento.
            </p>
          </div>
        </div>
      </div>

      {/* Members List */}
      <MembersList
        members={members}
        invites={invites}
        sharedAccounts={sharedAccounts}
        onRefresh={fetchData}
      />

      {/* Invite Modal */}
      <InviteMemberModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        onSuccess={fetchData}
      />
    </div>
  );
}
