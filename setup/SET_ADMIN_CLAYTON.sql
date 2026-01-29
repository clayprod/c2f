-- Script SQL para transformar o usuário clayton.mcosta@icloud.com em admin
-- IMPORTANTE: Este script deve ser executado com privilégios de service_role ou admin do banco
-- devido às políticas RLS (Row Level Security) na tabela profiles

-- Opção 1: Usando o campo email diretamente (se ainda existir)
UPDATE public.profiles
SET role = 'admin',
    updated_at = NOW()
WHERE LOWER(email) = LOWER('clayton.mcosta@icloud.com');

-- Opção 2: Se o email estiver criptografado, usar a view profiles_decrypted
-- (Descomente se a Opção 1 não funcionar)
/*
UPDATE public.profiles p
SET role = 'admin',
    updated_at = NOW()
FROM public.profiles_decrypted pd
WHERE p.id = pd.id
  AND LOWER(pd.email) = LOWER('clayton.mcosta@icloud.com');
*/

-- Verificar se a atualização foi bem-sucedida
SELECT 
    id,
    email,
    role,
    full_name,
    updated_at
FROM public.profiles
WHERE LOWER(email) = LOWER('clayton.mcosta@icloud.com');

-- Se o email estiver criptografado, usar esta query para verificar:
/*
SELECT 
    id,
    email,
    role,
    full_name,
    updated_at
FROM public.profiles_decrypted
WHERE LOWER(email) = LOWER('clayton.mcosta@icloud.com');
*/

