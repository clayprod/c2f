'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminFiltersWrapper from '@/components/admin/AdminFiltersWrapper';
import GlobalSettings from '@/components/admin/GlobalSettings';
import PriceManagement from '@/components/admin/PriceManagement';
import UserManagement from '@/components/admin/UserManagement';
import WhatsAppSettings from '@/components/admin/WhatsAppSettings';

// Importação dinâmica para evitar problemas de resolução de módulos durante o build
const BrazilMap = dynamic(() => import('@/components/admin/BrazilMap'), {
  ssr: false,
  loading: () => <div className="text-center py-8">Carregando mapa...</div>,
});

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.push('/app');
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking admin access:', error);
      router.push('/app');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Painel Administrativo</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie configurações globais, visualize dados agregados e monitore a plataforma
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="map">Mapa</TabsTrigger>
          <TabsTrigger value="reports">Relatorios</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="settings">Config</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="prices">Precos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <AdminDashboard />
        </TabsContent>

        <TabsContent value="map" className="mt-6">
          <BrazilMap />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <div className="space-y-4">
            <AdminFiltersWrapper />
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UserManagement />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <GlobalSettings />
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-6">
          <WhatsAppSettings />
        </TabsContent>

        <TabsContent value="prices" className="mt-6">
          <PriceManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}

