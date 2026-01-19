'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import GrantPlanModal from './GrantPlanModal';
import RevokePlanModal from './RevokePlanModal';

interface UserPlanInfo {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  plan: 'free' | 'pro' | 'premium';
  status: string;
  current_period_end: Date | null;
  is_manual: boolean;
  granted_by: string | null;
  granted_at: Date | null;
  stripe_subscription_id: string | null;
}

interface ListUsersResult {
  users: UserPlanInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserPlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isManualFilter, setIsManualFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserPlanInfo | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [page, planFilter, statusFilter, isManualFilter, searchQuery]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      if (planFilter !== 'all') params.append('plan', planFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (isManualFilter !== 'all') params.append('is_manual', isManualFilter === 'manual' ? 'true' : 'false');
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      
      const data: ListUsersResult = await res.json();
      setUsers(data.users);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantPlan = (user: UserPlanInfo) => {
    setSelectedUser(user);
    setGrantModalOpen(true);
  };

  const handleRevokePlan = (user: UserPlanInfo) => {
    setSelectedUser(user);
    setRevokeModalOpen(true);
  };

  const handleModalClose = () => {
    setGrantModalOpen(false);
    setRevokeModalOpen(false);
    setSelectedUser(null);
    fetchUsers(); // Refresh list
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'premium':
        return 'default';
      case 'pro':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const isPlanActive = (user: UserPlanInfo) => {
    if (user.plan === 'free') return false;
    if (user.status !== 'active') return false;
    if (!user.current_period_end) return true;
    return new Date(user.current_period_end) > new Date();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Usuários</CardTitle>
          <CardDescription>
            Visualize e gerencie planos de usuários ({total} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            <Input
              placeholder="Buscar por email ou nome..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
            <Select value={planFilter} onValueChange={(value) => {
              setPlanFilter(value);
              setPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={isManualFilter} onValueChange={(value) => {
              setIsManualFilter(value);
              setPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8">Carregando usuários...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário encontrado
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expiração</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const active = isPlanActive(user);
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.full_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={getPlanBadgeVariant(user.plan)}>
                              {user.plan.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={active ? 'default' : 'outline'}>
                              {active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(user.current_period_end)}</TableCell>
                          <TableCell>
                            {user.is_manual ? (
                              <Badge variant="secondary">Manual</Badge>
                            ) : (
                              <Badge variant="outline">Pago</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {user.plan !== 'free' && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleRevokePlan(user)}
                                >
                                  Revogar
                                </Button>
                              )}
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleGrantPlan(user)}
                              >
                                {user.plan === 'free' ? 'Conceder' : 'Alterar'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedUser && (
        <>
          <GrantPlanModal
            open={grantModalOpen}
            onOpenChange={setGrantModalOpen}
            user={selectedUser}
            onSuccess={handleModalClose}
          />
          <RevokePlanModal
            open={revokeModalOpen}
            onOpenChange={setRevokeModalOpen}
            user={selectedUser}
            onSuccess={handleModalClose}
          />
        </>
      )}
    </div>
  );
}
