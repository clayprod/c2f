# Como Limpar Categorias Órfãs de Investimentos

## Problema

Quando investimentos são deletados do banco de dados, suas categorias associadas não são removidas automaticamente, criando categorias órfãs que aparecem na lista de categorias sem uso.

## Solução Implementada

### 1. Script de Limpeza Manual

O arquivo `setup/CLEANUP_ORPHAN_INVESTMENT_CATEGORIES.sql` contém um script SQL que:

- **Identifica** categorias órfãs de investimentos deletados
- **Lista** detalhadamente as categorias órfãs encontradas
- **Remove** categorias órfãs que não são usadas por outras entidades

**Como usar:**

1. Execute o script no Supabase Dashboard > SQL Editor
2. Primeiro execute a seção de **VERIFICAR** para ver quantas categorias órfãs existem
3. Revise a lista detalhada de categorias órfãs
4. Execute a seção de **DELETAR** para remover as categorias órfãs
5. Execute a seção de **VERIFICAR** novamente para confirmar que foram removidas

**Importante:** O script só deleta categorias que:
- Foram criadas para investimentos (source_type = 'investment' OU padrão visual específico)
- Não têm investimento associado
- Não têm transações associadas
- Não têm budgets associados
- Não têm goals, debts, receivables ou assets associados

### 2. Migration Automática (Prevenção Futura)

A migration `supabase/migrations/053_add_investment_category_cascade.sql` implementa:

- **Foreign Key** com `ON DELETE SET NULL` para `category_id` na tabela `investments`
- **Trigger automático** que limpa categorias órfãs quando um investimento é deletado
- **Função de limpeza** que verifica se a categoria não é usada por outras entidades antes de deletar

**Como aplicar:**

A migration será aplicada automaticamente quando você executar as migrations pendentes. Ela garante que:

- Quando um investimento é deletado, o trigger verifica se a categoria associada pode ser removida
- A categoria só é removida se não for usada por transações, budgets, goals, debts, receivables ou assets
- Isso previne a criação de novas categorias órfãs no futuro

## Identificação de Categorias Órfãs

O sistema identifica categorias órfãs de investimentos através de:

1. **source_type = 'investment'**: Categorias criadas explicitamente para investimentos
2. **Padrão visual**: Categorias com:
   - Ícone: 📊
   - Cor: #00CED1
   - Tipo: expense

## Segurança

Tanto o script manual quanto o trigger automático verificam múltiplas condições antes de deletar uma categoria:

- ✅ Não há investimentos usando a categoria
- ✅ Não há transações usando a categoria
- ✅ Não há budgets usando a categoria
- ✅ Não há goals usando a categoria
- ✅ Não há debts usando a categoria
- ✅ Não há receivables usando a categoria
- ✅ Não há assets usando a categoria

Isso garante que categorias que ainda são úteis não sejam removidas acidentalmente.

## Exemplo de Uso

```sql
-- 1. Verificar categorias órfãs
-- Execute a primeira seção do script CLEANUP_ORPHAN_INVESTMENT_CATEGORIES.sql

-- 2. Se houver categorias órfãs, executar a limpeza
-- Execute a seção DELETE do script

-- 3. Verificar novamente
-- Execute a última seção do script para confirmar
```

## Notas

- O script pode ser executado múltiplas vezes sem problemas
- Categorias que são usadas por outras entidades não serão removidas
- A migration garante que futuras deleções de investimentos não criarão novas categorias órfãs
