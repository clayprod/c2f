-- Script para diagnosticar problemas com admin permissions e plan management
-- Execute no Supabase Dashboard -> SQL Editor

-- 1. Verificar se usuário tem role admin
SELECT id, email, role FROM public.profiles WHERE email = 'clayton@tenryu.com';

-- 2. Verificar estrutura da tabela billing_subscriptions
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'billing_subscriptions' 
  AND table_schema = 'public'
  AND column_name IN ('is_manual', 'granted_by', 'granted_at', 'stripe_subscription_id');

-- 3. Verificar políticas RLS existentes para billing_subscriptions
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'billing_subscriptions';

-- 4. Verificar se há alguma subscription existente
SELECT COUNT(*) as total_subscriptions,
       COUNT(CASE WHEN is_manual = true THEN 1 END) as manual_subscriptions,
       COUNT(CASE WHEN granted_by IS NOT NULL THEN 1 END) as granted_subscriptions
FROM public.billing_subscriptions;

-- 5. Obter o ID do admin primeiro
SELECT id, email, role FROM public.profiles WHERE email = 'clayton@tenryu.com' AND role = 'admin';

-- 6. Verificar se a function is_admin existe
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'is_admin' 
  AND routine_schema = 'public';
