# Configuração de Renda Mensal e Reserva de Emergência

## Problema: Erro de Schema Cache

Se você está recebendo o erro:
```
Could not find the 'monthly_income_cents' column of 'profiles' in the schema cache
```

Isso significa que as migrations não foram aplicadas ou o cache do PostgREST precisa ser atualizado.

## Solução

### 1. Aplicar as Migrations

Execute as seguintes migrations na ordem:

1. `029_add_monthly_income_and_emergency_goal.sql`
2. `030_update_handle_new_user_monthly_income.sql`

### 2. Atualizar o Cache do PostgREST (Supabase)

Se você está usando Supabase, o cache do PostgREST pode precisar ser atualizado:

**Opção A: Via Dashboard do Supabase**
1. Acesse o Dashboard do Supabase
2. Vá em **Database** > **API**
3. Clique em **Refresh Schema Cache** ou **Reload Schema**

**Opção B: Via SQL**
Execute no SQL Editor do Supabase:
```sql
NOTIFY pgrst, 'reload schema';
```

**Opção C: Reiniciar o PostgREST**
Se você tem acesso ao servidor, reinicie o serviço PostgREST.

### 3. Verificar se a Coluna Existe

Execute no SQL Editor:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'monthly_income_cents';
```

Se retornar vazio, a migration não foi aplicada.

## Funcionalidades Implementadas

1. **Campo de Renda Mensal no Cadastro**: Obrigatório no signup
2. **Campo de Renda Mensal nas Configurações**: Pode ser editado
3. **Objetivo Automático**: Cria/atualiza "Reserva de Emergência" com valor de 6x a renda mensal
4. **Formatação de Moeda**: Valores formatados em reais brasileiros (R$ 1.234,56)

## Formatação de Valores

Os valores são armazenados em **centavos** no banco de dados, mas exibidos em **reais** no frontend.

- Input: Usuário digita "1234,56" → Armazenado como `123456` centavos
- Display: `123456` centavos → Exibido como "R$ 1.234,56"
