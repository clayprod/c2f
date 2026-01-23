-- Script para limpar budgets órfãos de todas as entidades deletadas
-- Execute este script para remover budgets com source_type que não existe mais na tabela de origem

-- ============================================
-- 1. VERIFICAR BUDGETS ÓRFÃOS
-- ============================================

-- Verificar budgets órfãos de investimentos
SELECT 
  'investment' as source_type,
  COUNT(*) as orphan_budgets_count,
  COUNT(DISTINCT b.user_id) as affected_users,
  STRING_AGG(DISTINCT p.email, ', ') as affected_emails
FROM public.budgets b
LEFT JOIN public.profiles p ON p.id = b.user_id
WHERE b.source_type = 'investment'
  AND b.source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.investments i 
    WHERE i.id = b.source_id
  )

UNION ALL

-- Verificar budgets órfãos de goals
SELECT 
  'goal' as source_type,
  COUNT(*) as orphan_budgets_count,
  COUNT(DISTINCT b.user_id) as affected_users,
  STRING_AGG(DISTINCT p.email, ', ') as affected_emails
FROM public.budgets b
LEFT JOIN public.profiles p ON p.id = b.user_id
WHERE b.source_type = 'goal'
  AND b.source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.goals g 
    WHERE g.id = b.source_id
  )

UNION ALL

-- Verificar budgets órfãos de debts
SELECT 
  'debt' as source_type,
  COUNT(*) as orphan_budgets_count,
  COUNT(DISTINCT b.user_id) as affected_users,
  STRING_AGG(DISTINCT p.email, ', ') as affected_emails
FROM public.budgets b
LEFT JOIN public.profiles p ON p.id = b.user_id
WHERE b.source_type = 'debt'
  AND b.source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.debts d 
    WHERE d.id = b.source_id
  )

UNION ALL

-- Verificar budgets órfãos de receivables
SELECT 
  'receivable' as source_type,
  COUNT(*) as orphan_budgets_count,
  COUNT(DISTINCT b.user_id) as affected_users,
  STRING_AGG(DISTINCT p.email, ', ') as affected_emails
FROM public.budgets b
LEFT JOIN public.profiles p ON p.id = b.user_id
WHERE b.source_type = 'receivable'
  AND b.source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.receivables r 
    WHERE r.id = b.source_id
  )

UNION ALL

-- Verificar budgets órfãos de credit cards (bills)
SELECT 
  'credit_card' as source_type,
  COUNT(*) as orphan_budgets_count,
  COUNT(DISTINCT b.user_id) as affected_users,
  STRING_AGG(DISTINCT p.email, ', ') as affected_emails
FROM public.budgets b
LEFT JOIN public.profiles p ON p.id = b.user_id
WHERE b.source_type = 'credit_card'
  AND b.source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.credit_card_bills ccb 
    WHERE ccb.id = b.source_id
  );

-- ============================================
-- 2. DELETAR BUDGETS ÓRFÃOS
-- ============================================

-- Deletar budgets órfãos de investimentos
DELETE FROM public.budgets
WHERE source_type = 'investment'
  AND source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.investments i 
    WHERE i.id = budgets.source_id
  );

-- Deletar budgets órfãos de goals
DELETE FROM public.budgets
WHERE source_type = 'goal'
  AND source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.goals g 
    WHERE g.id = budgets.source_id
  );

-- Deletar budgets órfãos de debts
DELETE FROM public.budgets
WHERE source_type = 'debt'
  AND source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.debts d 
    WHERE d.id = budgets.source_id
  );

-- Deletar budgets órfãos de receivables
DELETE FROM public.budgets
WHERE source_type = 'receivable'
  AND source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.receivables r 
    WHERE r.id = budgets.source_id
  );

-- Deletar budgets órfãos de credit cards (bills)
DELETE FROM public.budgets
WHERE source_type = 'credit_card'
  AND source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.credit_card_bills ccb 
    WHERE ccb.id = budgets.source_id
  );

-- ============================================
-- 3. VERIFICAR SE AINDA EXISTEM BUDGETS ÓRFÃOS
-- ============================================

SELECT 
  'Total órfãos restantes' as status,
  COUNT(*) as count
FROM public.budgets b
WHERE (
  (b.source_type = 'investment' AND b.source_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.investments i WHERE i.id = b.source_id))
  OR (b.source_type = 'goal' AND b.source_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.goals g WHERE g.id = b.source_id))
  OR (b.source_type = 'debt' AND b.source_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.debts d WHERE d.id = b.source_id))
  OR (b.source_type = 'receivable' AND b.source_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.receivables r WHERE r.id = b.source_id))
  OR (b.source_type = 'credit_card' AND b.source_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.credit_card_bills ccb WHERE ccb.id = b.source_id))
);
