-- Script para limpar categorias órfãs de investimentos deletados
-- Execute este script para remover categorias que foram criadas para investimentos
-- mas cujo investimento não existe mais na tabela investments

-- ============================================
-- 1. VERIFICAR CATEGORIAS ÓRFÃS
-- ============================================

-- Verificar quantas categorias órfãs existem (criadas para investimentos que não existem mais)
SELECT 
  COUNT(*) as orphan_categories_count,
  COUNT(DISTINCT c.user_id) as affected_users,
  STRING_AGG(DISTINCT p.email, ', ') as affected_emails
FROM public.categories c
LEFT JOIN public.profiles p ON p.id = c.user_id
WHERE (
  -- Categorias que têm source_type = 'investment' mas não há investimento correspondente
  (c.source_type = 'investment' AND NOT EXISTS (
    SELECT 1 
    FROM public.investments i 
    WHERE i.category_id = c.id
  ))
  OR
  -- Categorias criadas para investimentos (baseado no padrão de nome e ícone)
  (c.icon = '📊' 
   AND c.color = '#00CED1' 
   AND c.type = 'expense'
   AND NOT EXISTS (
     SELECT 1 
     FROM public.investments i 
     WHERE i.category_id = c.id
   )
   AND NOT EXISTS (
     SELECT 1 
     FROM public.transactions t 
     WHERE t.category_id = c.id
   )
   AND NOT EXISTS (
     SELECT 1 
     FROM public.budgets b 
     WHERE b.category_id = c.id
   ))
)
-- Garantir que não há outras referências
AND NOT EXISTS (
  SELECT 1 
  FROM public.goals g 
  WHERE g.category_id = c.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.debts d 
  WHERE d.category_id = c.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.receivables r 
  WHERE r.category_id = c.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.assets a 
  WHERE a.category_id = c.id
);

-- Listar categorias órfãs detalhadas
SELECT 
  c.id,
  c.name,
  c.user_id,
  p.email as user_email,
  c.created_at,
  c.source_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.transactions t WHERE t.category_id = c.id) THEN 'Tem transações'
    WHEN EXISTS (SELECT 1 FROM public.budgets b WHERE b.category_id = c.id) THEN 'Tem budgets'
    WHEN EXISTS (SELECT 1 FROM public.goals g WHERE g.category_id = c.id) THEN 'Tem goals'
    WHEN EXISTS (SELECT 1 FROM public.debts d WHERE d.category_id = c.id) THEN 'Tem debts'
    WHEN EXISTS (SELECT 1 FROM public.receivables r WHERE r.category_id = c.id) THEN 'Tem receivables'
    WHEN EXISTS (SELECT 1 FROM public.assets a WHERE a.category_id = c.id) THEN 'Tem assets'
    ELSE 'Sem referências'
  END as status
FROM public.categories c
LEFT JOIN public.profiles p ON p.id = c.user_id
WHERE (
  -- Categorias que têm source_type = 'investment' mas não há investimento correspondente
  (c.source_type = 'investment' AND NOT EXISTS (
    SELECT 1 
    FROM public.investments i 
    WHERE i.category_id = c.id
  ))
  OR
  -- Categorias criadas para investimentos (baseado no padrão de nome e ícone)
  (c.icon = '📊' 
   AND c.color = '#00CED1' 
   AND c.type = 'expense'
   AND NOT EXISTS (
     SELECT 1 
     FROM public.investments i 
     WHERE i.category_id = c.id
   )
   AND NOT EXISTS (
     SELECT 1 
     FROM public.transactions t 
     WHERE t.category_id = c.id
   )
   AND NOT EXISTS (
     SELECT 1 
     FROM public.budgets b 
     WHERE b.category_id = c.id
   ))
)
-- Garantir que não há outras referências
AND NOT EXISTS (
  SELECT 1 
  FROM public.goals g 
  WHERE g.category_id = c.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.debts d 
  WHERE d.category_id = c.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.receivables r 
  WHERE r.category_id = c.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.assets a 
  WHERE a.category_id = c.id
)
ORDER BY c.user_id, c.created_at DESC;

-- ============================================
-- 2. DELETAR CATEGORIAS ÓRFÃS
-- ============================================

-- IMPORTANTE: Este script só deleta categorias que:
-- 1. Foram criadas para investimentos (source_type = 'investment' OU padrão visual)
-- 2. Não têm investimento associado
-- 3. NÃO têm transações associadas
-- 4. NÃO têm budgets associados

-- Deletar categorias órfãs de investimentos (todos os usuários)
DELETE FROM public.categories
WHERE (
  -- Categorias que têm source_type = 'investment' mas não há investimento correspondente
  (source_type = 'investment' AND NOT EXISTS (
    SELECT 1 
    FROM public.investments i 
    WHERE i.category_id = categories.id
  ))
  OR
  -- Categorias criadas para investimentos (baseado no padrão de nome e ícone)
  (icon = '📊' 
   AND color = '#00CED1' 
   AND type = 'expense'
   AND NOT EXISTS (
     SELECT 1 
     FROM public.investments i 
     WHERE i.category_id = categories.id
   )
   AND NOT EXISTS (
     SELECT 1 
     FROM public.transactions t 
     WHERE t.category_id = categories.id
   )
   AND NOT EXISTS (
     SELECT 1 
     FROM public.budgets b 
     WHERE b.category_id = categories.id
   ))
)
-- Garantir que não há outras referências (segurança extra)
AND NOT EXISTS (
  SELECT 1 
  FROM public.transactions t 
  WHERE t.category_id = categories.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.budgets b 
  WHERE b.category_id = categories.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.goals g 
  WHERE g.category_id = categories.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.debts d 
  WHERE d.category_id = categories.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.receivables r 
  WHERE r.category_id = categories.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.assets a 
  WHERE a.category_id = categories.id
);

-- Ou para um usuário específico (substitua o email):
-- DELETE FROM public.categories
-- WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'clayton@tenryu.com')
-- AND (
--   (source_type = 'investment' AND NOT EXISTS (
--     SELECT 1 
--     FROM public.investments i 
--     WHERE i.category_id = categories.id
--   ))
--   OR
--   (icon = '📊' 
--    AND color = '#00CED1' 
--    AND type = 'expense'
--    AND NOT EXISTS (
--      SELECT 1 
--      FROM public.investments i 
--      WHERE i.category_id = categories.id
--    )
--    AND NOT EXISTS (
--      SELECT 1 
--      FROM public.transactions t 
--      WHERE t.category_id = categories.id
--    )
--    AND NOT EXISTS (
--      SELECT 1 
--      FROM public.budgets b 
--      WHERE b.category_id = categories.id
--    ))
-- )
-- AND NOT EXISTS (
--   SELECT 1 
--   FROM public.transactions t 
--   WHERE t.category_id = categories.id
-- )
-- AND NOT EXISTS (
--   SELECT 1 
--   FROM public.budgets b 
--   WHERE b.category_id = categories.id
-- );

-- ============================================
-- 3. VERIFICAR SE AINDA EXISTEM CATEGORIAS ÓRFÃS
-- ============================================

SELECT 
  COUNT(*) as remaining_orphan_categories
FROM public.categories c
WHERE (
  (c.source_type = 'investment' AND NOT EXISTS (
    SELECT 1 
    FROM public.investments i 
    WHERE i.category_id = c.id
  ))
  OR
  (c.icon = '📊' 
   AND c.color = '#00CED1' 
   AND c.type = 'expense'
   AND NOT EXISTS (
     SELECT 1 
     FROM public.investments i 
     WHERE i.category_id = c.id
   )
   AND NOT EXISTS (
     SELECT 1 
     FROM public.transactions t 
     WHERE t.category_id = c.id
   )
   AND NOT EXISTS (
     SELECT 1 
     FROM public.budgets b 
     WHERE b.category_id = c.id
   ))
)
-- Garantir que não há outras referências
AND NOT EXISTS (
  SELECT 1 
  FROM public.goals g 
  WHERE g.category_id = c.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.debts d 
  WHERE d.category_id = c.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.receivables r 
  WHERE r.category_id = c.id
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.assets a 
  WHERE a.category_id = c.id
);
