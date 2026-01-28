-- Query para excluir todos os usuários exceto clayton@tenryu.com
-- ATENÇÃO: Esta operação é IRREVERSÍVEL e deletará TODOS os dados relacionados
-- (transações, contas, categorias, orçamentos, etc.) devido ao ON DELETE CASCADE

-- Opção 1: Usando DELETE direto na tabela auth.users
-- (Requer permissões de service_role ou admin)
DELETE FROM auth.users
WHERE email != 'clayton@tenryu.com';

-- Opção 2: Usando a função auth.delete_user() para cada usuário
-- (Mais seguro, mas requer loop)
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT id, email 
        FROM auth.users 
        WHERE email != 'clayton@tenryu.com'
    LOOP
        PERFORM auth.delete_user(user_record.id);
        RAISE NOTICE 'Usuário deletado: %', user_record.email;
    END LOOP;
END $$;

-- Verificação: Contar usuários restantes
SELECT COUNT(*) as total_usuarios, email 
FROM auth.users 
GROUP BY email;

