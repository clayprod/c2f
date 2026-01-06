# Como Executar a Migration - Corrigir Upload de Imagens em Objetivos

## Problema Corrigido

O erro ao fazer upload de imagens em objetivos acontecia porque a tabela `goals` não tinha as colunas necessárias (`image_url`, `image_position`, `monthly_contribution_cents`, etc).

## Solução Implementada

### 1. Código com Fallback Automático ✅

O código agora possui fallback automático que:
- Tenta primeiro salvar com todos os campos (incluindo imagem e contribuições)
- Se detectar erro de coluna não encontrada (PGRST204), tenta novamente sem esses campos
- Retorna um aviso para o usuário executar a migration

**Arquivos modificados:**
- `src/app/api/goals/[id]/route.ts` - PATCH endpoint
- `src/app/api/goals/route.ts` - POST endpoint

### 2. Migration SQL para Executar no Supabase

**Arquivo:** `EXECUTAR_MIGRATION.sql`

## Passo a Passo para Executar a Migration

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor**
4. Clique em **New Query**
5. Copie todo o conteúdo do arquivo `EXECUTAR_MIGRATION.sql`
6. Cole no editor
7. Clique em **Run** ou pressione `Ctrl+Enter`
8. Aguarde a execução (deve levar alguns segundos)
9. Verifique se não há erros na saída

### Opção 2: Via Supabase CLI

```bash
# Copie o arquivo para o diretório de migrations
cp EXECUTAR_MIGRATION.sql supabase/migrations/999_manual_migration.sql

# Execute a migration
supabase db push
```

## Verificação

Após executar a migration:

1. Tente criar ou editar um objetivo novamente
2. Faça upload de uma imagem
3. Ajuste a posição da imagem
4. Salve o objetivo

**Se tudo estiver correto:**
- ✅ Nenhum erro 500
- ✅ A imagem é salva corretamente
- ✅ Nenhum aviso sobre campos não salvos

**Se ainda houver problemas:**
- ⚠️ Verifique se a migration foi executada com sucesso
- ⚠️ Verifique se há erros no log do Supabase
- ⚠️ Aguarde alguns minutos para o schema cache atualizar

## O que a Migration Faz

### Colunas Adicionadas

#### Tabela `goals`
- `image_url` (TEXT) - URL da imagem
- `image_position` (TEXT) - Posição da imagem ("center", "50% 50%", etc)
- `include_in_budget` (BOOLEAN) - Flag para incluir no orçamento
- `contribution_frequency` (TEXT) - Frequência de aportes
- `monthly_contribution_cents` (BIGINT) - Valor mensal do aporte

#### Tabela `debts`
- `include_in_budget` (BOOLEAN)
- `contribution_frequency` (TEXT)
- `monthly_payment_cents` (BIGINT)

#### Tabela `investments`
- `include_in_budget` (BOOLEAN)
- `contribution_frequency` (TEXT)
- `monthly_contribution_cents` (BIGINT)

#### Tabela `transactions`
- `contribution_frequency` (TEXT)

#### Tabela `budgets`
- `minimum_amount_planned` (NUMERIC)
- `auto_contributions_cents` (BIGINT)

### Índices Criados

- Índices para melhorar performance de queries relacionadas a orçamentos automáticos
- Índices apenas para registros ativos com `include_in_budget = TRUE`

## Comportamento do Sistema

### Antes da Migration
- ❌ Erro 500 ao salvar objetivos com imagem
- ❌ Campos de contribuição não funcionam
- ✅ Sistema continua funcionando para campos básicos (fallback)

### Após a Migration
- ✅ Upload e posicionamento de imagens funciona
- ✅ Orçamentos automáticos baseados em objetivos, dívidas e investimentos
- ✅ Validação de valores mínimos em orçamentos
- ✅ Todas as features habilitadas

## Suporte

Se encontrar problemas:
1. Verifique o console do navegador (F12) para mensagens de erro
2. Verifique o log do servidor Next.js
3. Verifique o log do Supabase Dashboard
4. Crie uma issue no repositório com os logs

## Reversão (se necessário)

Para reverter as alterações (não recomendado):

```sql
-- Remover colunas de goals
ALTER TABLE public.goals
DROP COLUMN IF EXISTS image_url,
DROP COLUMN IF EXISTS image_position,
DROP COLUMN IF EXISTS include_in_budget,
DROP COLUMN IF EXISTS contribution_frequency,
DROP COLUMN IF EXISTS monthly_contribution_cents;

-- E assim por diante para outras tabelas...
```

**Atenção:** Reverter a migration causará perda de dados salvos nessas colunas!
