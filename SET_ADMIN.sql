-- ============================================
-- SET ADMIN: Dar permissoes de admin ao usuario
-- ============================================
-- Execute este SQL no Supabase Dashboard -> SQL Editor

-- 1. Verificar se o usuario existe
SELECT id, email, role FROM public.profiles WHERE email = 'clayton@tenryu.com';

-- 2. Atualizar role para admin
UPDATE public.profiles
SET role = 'admin', updated_at = NOW()
WHERE email = 'clayton@tenryu.com';

-- 3. Verificar se foi atualizado
SELECT id, email, role FROM public.profiles WHERE email = 'clayton@tenryu.com';
