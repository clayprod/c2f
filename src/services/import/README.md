# Importação de Transações CSV

## Formato do CSV

O sistema suporta importação de transações no formato `cashflow.csv`:

```
ID;DESCRIÇÃO;DATA;VALOR;CONTA;CATEGORIA;TIPO
5409;BARBEIRO;45878;50;C.C CLAYTON;BELEZA;D
```

### Estrutura das colunas:

1. **ID** - Identificador único da transação (usado para deduplicação)
2. **DESCRIÇÃO** - Descrição da transação
3. **DATA** - Data em formato Excel (número de dias desde 1900-01-01)
4. **VALOR** - Valor em reais (formato brasileiro: vírgula como separador decimal)
5. **CONTA** - Nome da conta bancária
6. **CATEGORIA** - Nome da categoria
7. **TIPO** - `D` para despesa (debit) ou `E` para receita (expense/income)

## Funcionalidades

- **Parsing automático**: Converte formato Excel date para ISO date
- **Deduplicação**: Usa `provider_tx_id` para evitar duplicatas
- **Criação automática**: Cria categorias e contas se não existirem
- **Validação**: Valida formato e valores antes de importar
- **Logs**: Registra cada importação na tabela `imports`

## Endpoints

### `POST /api/import/csv`

Importa transações de um arquivo CSV.

**Request:**
- `file`: Arquivo CSV (multipart/form-data)
- `account_id` (opcional): ID da conta para associar as transações

**Response:**
```json
{
  "success": true,
  "totalRows": 100,
  "imported": 95,
  "skipped": 5,
  "errors": [],
  "importId": "uuid"
}
```

### `GET /api/import`

Lista histórico de importações do usuário.

## Uso

```typescript
const formData = new FormData();
formData.append('file', csvFile);
formData.append('account_id', accountId); // opcional

const response = await fetch('/api/import/csv', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
```

## Observações

- Valores são armazenados em `numeric` (reais), não em centavos
- Transações duplicadas são automaticamente ignoradas
- Categorias são criadas automaticamente se não existirem
- Se não for fornecida uma conta, usa a primeira conta do usuário ou cria uma padrão





