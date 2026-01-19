'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AdminFiltersProps {
  onFiltersChange?: (filters: any) => void;
}

export default function AdminFilters({ onFiltersChange }: AdminFiltersProps) {
  const [period, setPeriod] = useState<string>('month');
  const [search, setSearch] = useState('');
  const [minAge, setMinAge] = useState<number | undefined>();
  const [maxAge, setMaxAge] = useState<number | undefined>();
  const [gender, setGender] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<string>('state');

  const handleApplyFilters = () => {
    const filters: any = {
      period,
      search: search || undefined,
      min_age: minAge,
      max_age: maxAge,
      gender: gender === 'all' ? undefined : gender,
      group_by: groupBy,
    };
    onFiltersChange?.(filters);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Período</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Último mês</SelectItem>
                <SelectItem value="3months">3 meses</SelectItem>
                <SelectItem value="semester">Semestre</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Buscar na descrição</Label>
            <Input
              placeholder="Palavras-chave..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <Label>Agrupar por</Label>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="state">Estado</SelectItem>
                <SelectItem value="city">Cidade</SelectItem>
                <SelectItem value="category">Categoria</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Idade mínima</Label>
            <Input
              type="number"
              placeholder="Ex: 18"
              value={minAge || ''}
              onChange={(e) => setMinAge(e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>

          <div>
            <Label>Idade máxima</Label>
            <Input
              type="number"
              placeholder="Ex: 65"
              value={maxAge || ''}
              onChange={(e) => setMaxAge(e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>

          <div>
            <Label>Gênero</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="male_cis">Homem</SelectItem>
                <SelectItem value="female_cis">Mulher</SelectItem>
                <SelectItem value="non_binary">Não-binário</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefiro não responder</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleApplyFilters}>Aplicar Filtros</Button>
      </CardContent>
    </Card>
  );
}


