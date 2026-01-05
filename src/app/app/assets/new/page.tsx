'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AssetForm from '@/components/assets/AssetForm';
import { useToast } from '@/hooks/use-toast';

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

export default function NewAssetPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch accounts
      const accountsResponse = await fetch('/api/accounts');
      const accountsResult = await accountsResponse.json();
      if (accountsResult.data) {
        setAccounts(accountsResult.data);
      }

      // Fetch categories
      const categoriesResponse = await fetch('/api/categories');
      const categoriesResult = await categoriesResponse.json();
      if (categoriesResult.data) {
        setCategories(categoriesResult.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      // Clean data: remove undefined and null values, convert empty strings to undefined
      const cleanedData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => {
          if (value === null || value === undefined || value === '') {
            return [key, undefined];
          }
          return [key, value];
        }).filter(([_, value]) => value !== undefined)
      );

      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanedData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar bem');
      }

      toast({
        title: 'Sucesso',
        description: 'Bem criado com sucesso!',
      });

      router.push('/app/assets');
    } catch (error: any) {
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Novo Bem</h1>
        <p className="text-muted-foreground">Adicione um novo bem ao seu patrimônio</p>
      </div>

      <div className="glass-card p-6">
        <AssetForm
          accounts={accounts}
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}

