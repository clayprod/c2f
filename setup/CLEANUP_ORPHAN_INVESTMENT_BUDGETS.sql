-- Script para limpar budgets órfãos de investimentos deletados
-- Execute este script para remover budgets com source_type='investment' 
-- cujo source_id não existe mais na tabela investments

-- Verificar quantos budgets órfãos existem
SELECT 
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
  );

-- Deletar budgets órfãos de investimentos (todos os usuários)
DELETE FROM public.budgets
WHERE source_type = 'investment'
  AND source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.investments i 
    WHERE i.id = budgets.source_id
  );

-- Ou para um usuário específico (substitua o email):
-- DELETE FROM public.budgets
-- WHERE source_type = 'investment'
--   AND source_id IS NOT NULL
--   AND user_id = (SELECT id FROM public.profiles WHERE email = 'clayton@tenryu.com')
--   AND NOT EXISTS (
--     SELECT 1 
--     FROM public.investments i 
--     WHERE i.id = budgets.source_id
--   );

-- Verificar se ainda existem budgets órfãos (deve retornar 0)
SELECT 
  COUNT(*) as remaining_orphan_budgets
FROM public.budgets b
WHERE b.source_type = 'investment'
  AND b.source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.investments i 
    WHERE i.id = b.source_id
  );
