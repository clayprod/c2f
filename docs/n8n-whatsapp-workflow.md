# c2Finance WhatsApp Agent - Workflow n8n v2

## Visão Geral

Workflow completo para controle financeiro via WhatsApp usando n8n + Groq LLM.

### Funcionalidades

- **Transações**: Criar, listar, excluir (inclusive parceladas)
- **Orçamentos**: Consultar e ajustar limites por categoria
- **Metas**: Criar metas, ver progresso, fazer aportes
- **Dívidas**: Cadastrar, consultar, registrar pagamentos
- **Relatórios**: Gerar relatório mensal com breakdown por categoria
- **Saldo**: Consultar saldo consolidado de todas as contas

### Melhorias em Relação à v1

1. **Message Buffering**: Aguarda 3 segundos para juntar múltiplas mensagens
2. **Categorização Automática**: Usa lógica existente do sistema (histórico + inferência)
3. **Parsing de Valores Robusto**: Instruções claras no prompt para evitar erros de conversão
4. **Comandos Expandidos**: Suporte completo a orçamentos, metas, dívidas e relatórios
5. **Tratamento de Erros**: Logs estruturados e fallbacks
6. **Clarificação Inteligente**: IA pede informações faltantes quando necessário

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORKFLOW N8N v2                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────────┐   │
│  │ Webhook  │───▶│ Filtrar  │───▶│ Extrair  │───▶│ Número Válido?       │   │
│  │ Evolution│    │ Mensagens│    │  Dados   │    │                      │   │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┬───────────┘   │
│                                                              │               │
│                               ┌──────────────────────────────┼───────────┐   │
│                               │                              ▼           │   │
│                               │                    ┌──────────────────┐  │   │
│                               │      É Áudio? ────▶│ Download Áudio   │  │   │
│                               │         │          └────────┬─────────┘  │   │
│                               │         │                   ▼            │   │
│                               │         │          ┌──────────────────┐  │   │
│                               │         │          │ Transcrever      │  │   │
│                               │         │          │ (Groq Whisper)   │  │   │
│                               │         │          └────────┬─────────┘  │   │
│                               │         │                   │            │   │
│                               │         ▼                   ▼            │   │
│                               │   ┌──────────────────────────────────┐   │   │
│                               │   │      Buffer Mensagem             │   │   │
│                               │   │   (Aguarda mais mensagens)       │   │   │
│                               │   └────────────────┬─────────────────┘   │   │
│                               │                    │                     │   │
│                               │                    ▼                     │   │
│                               │   ┌──────────────────────────────────┐   │   │
│                               │   │      Aguardar 3 segundos         │   │   │
│                               │   └────────────────┬─────────────────┘   │   │
│                               │                    │                     │   │
│                               │                    ▼                     │   │
│                               │   ┌──────────────────────────────────┐   │   │
│                               │   │   Obter Mensagens Bufferizadas   │   │   │
│                               │   └────────────────┬─────────────────┘   │   │
│                               │                    │                     │   │
│                               │          ┌────────┴────────┐             │   │
│                               │          ▼                 ▼             │   │
│                               │    (Aguardar)     ┌────────────────┐     │   │
│                               │                   │ Consolidar     │     │   │
│                               │                   │ Mensagens      │     │   │
│                               │                   └───────┬────────┘     │   │
│                               │                           ▼              │   │
│                               │                   ┌────────────────┐     │   │
│                               │                   │ Obter Contexto │     │   │
│                               │                   │ do Usuário     │     │   │
│                               │                   └───────┬────────┘     │   │
│                               │                           │              │   │
│                               │            ┌──────────────┴──────────┐   │   │
│                               │            ▼                         ▼   │   │
│                               │   ┌────────────────┐      ┌────────────┐ │   │
│                               │   │ Preparar       │      │ Não        │ │   │
│                               │   │ Prompt IA      │      │ Verificado │ │   │
│                               │   └───────┬────────┘      └────────────┘ │   │
│                               │           ▼                              │   │
│                               │   ┌────────────────┐                     │   │
│                               │   │ Chamar LLM     │                     │   │
│                               │   │ (Groq Llama)   │                     │   │
│                               │   └───────┬────────┘                     │   │
│                               │           ▼                              │   │
│                               │   ┌────────────────┐                     │   │
│                               │   │ Processar      │                     │   │
│                               │   │ Resposta IA    │                     │   │
│                               │   └───────┬────────┘                     │   │
│                               │           │                              │   │
│                               │   ┌───────┴───────┐                      │   │
│                               │   ▼               ▼                      │   │
│                               │ (API)         (Sem API)                  │   │
│                               │   │               │                      │   │
│                               │   ▼               │                      │   │
│                               │ ┌──────────┐      │                      │   │
│                               │ │ Executar │      │                      │   │
│                               │ │ Operação │      │                      │   │
│                               │ └────┬─────┘      │                      │   │
│                               │      │            │                      │   │
│                               │      └─────┬──────┘                      │   │
│                               │            ▼                             │   │
│                               │   ┌────────────────┐                     │   │
│                               │   │ Enviar         │                     │   │
│                               │   │ WhatsApp       │                     │   │
│                               │   └───────┬────────┘                     │   │
│                               │           ▼                              │   │
│                               │   ┌────────────────┐                     │   │
│                               │   │ Responder      │                     │   │
│                               │   │ Webhook        │                     │   │
│                               │   └────────────────┘                     │   │
│                               └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints Utilizados

### Backend c2Finance

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/n8n/operations` | POST | Endpoint unificado para todas as operações |

### Operações Suportadas

| Operation | Descrição | Dados Necessários |
|-----------|-----------|-------------------|
| `buffer_message` | Armazena mensagem no buffer | `buffer_message.text`, `buffer_message.type` |
| `get_buffered_messages` | Obtém mensagens do buffer | - |
| `categorize` | Auto-categoriza por descrição | `data.description`, `data.amount` |
| `create_transaction` | Cria transação | `data.description`, `data.amount_cents`, `data.category_name` |
| `delete_transaction` | Exclui transação | `data.id` ou `data.search_description` ou `data.delete_last` |
| `query_balance` | Consulta saldo | - |
| `list_transactions` | Lista transações | `data.period`, `data.limit` |
| `query_budgets` | Lista orçamentos | `data.month` |
| `update_budget` | Atualiza orçamento | `data.category_name`, `data.amount_cents` |
| `query_goals` | Lista metas | - |
| `create_goal` | Cria meta | `data.name`, `data.target_amount_cents` |
| `contribute_goal` | Aporte em meta | `data.goal_name`, `data.amount_cents` |
| `query_debts` | Lista dívidas | - |
| `create_debt` | Cadastra dívida | `data.name`, `data.total_amount_cents` |
| `pay_debt` | Paga dívida | `data.debt_name`, `data.amount_cents` |
| `generate_report` | Gera relatório | `data.month` |
| `get_context` | Contexto completo | - |

---

## Configuração de Ambiente

### Variáveis de Ambiente no n8n

Antes de importar o workflow, configure as variáveis de ambiente:

```bash
# No servidor n8n, editar /etc/n8n/env ou configurar via UI

C2F_API_KEY=<sua_chave_c2f>
GROQ_API_KEY=<sua_chave_groq>
EVOLUTION_API_KEY=<sua_chave_evolution>
```

### Ou via Credentials no n8n

1. Acesse **Settings > Variables**
2. Adicione:
   - `C2F_API_KEY`: Chave de API do c2Finance
   - `GROQ_API_KEY`: Chave da API Groq
   - `EVOLUTION_API_KEY`: Chave da Evolution API

---

## Importar Workflow

### Via API

```bash
curl -X POST "https://n8n.tenryu.com.br/api/v1/workflows" \
  -H "X-N8N-API-KEY: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @n8n-workflow-improved.json
```

### Via Interface

1. Acesse https://n8n.tenryu.com.br
2. Clique em **+ Add Workflow**
3. Clique nos 3 pontinhos **⋮ > Import from File**
4. Selecione `n8n-workflow-improved.json`
5. Configure as credenciais
6. Ative o workflow

---

## Configurar Webhook no Evolution API

Após importar e ativar o workflow, configure o webhook:

```bash
curl -X POST "https://evolution.tenryu.com.br/webhook/set/c2f_transactions" \
  -H "apikey: 9051629CA844-4753-8B82-909612FE4BAC" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "https://n8n.tenryu.com.br/webhook/c2f-whatsapp-v2",
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```

---

## Exemplos de Uso

### Criar Transação

**Usuário**: "Gastei 150 reais no mercado hoje"

**IA processa**:
```json
{
  "operation": "create_transaction",
  "data": {
    "description": "Mercado",
    "amount_cents": -15000,
    "posted_at": "2026-01-25",
    "category_name": "Supermercado"
  },
  "response_message": "Registrei uma despesa de R$ 150,00 no Mercado, categoria Supermercado."
}
```

**Resposta WhatsApp**: "✅ Registrei uma despesa de R$ 150,00 no Mercado, categoria Supermercado."

### Parcelamento

**Usuário**: "Comprei uma TV de 3000 em 10x no cartão"

**IA processa**:
```json
{
  "operation": "create_transaction",
  "data": {
    "description": "TV",
    "amount_cents": -300000,
    "posted_at": "2026-01-25",
    "category_name": "Compras",
    "installment_total": 10
  },
  "response_message": "Registrei a compra da TV de R$ 3.000,00 em 10 parcelas de R$ 300,00."
}
```

### Consultar Saldo

**Usuário**: "quanto tenho?"

**Resposta WhatsApp**:
```
💰 Seu Saldo

📊 Resumo do Mês
- Receitas: R$ 5.000,00
- Despesas: R$ 2.350,00
- Saldo: R$ 2.650,00

🏦 Contas
- Conta Corrente: R$ 3.500,00
- Poupança: R$ 10.000,00

💳 Cartões
- Nubank: R$ 1.200,00 disponível
```

### Criar Meta

**Usuário**: "Quero criar uma meta de 10 mil pra viagem em dezembro"

**IA processa**:
```json
{
  "operation": "create_goal",
  "data": {
    "name": "Viagem",
    "target_amount_cents": 1000000,
    "target_date": "2026-12-01",
    "description": "Meta para viagem de fim de ano"
  },
  "response_message": "Criei sua meta 'Viagem' de R$ 10.000,00 para dezembro. Sugiro aportes de R$ 910,00/mês."
}
```

### Pedir Esclarecimento

**Usuário**: "gastei no mercado"

**IA detecta valor faltando**:
```json
{
  "operation": "clarify",
  "data": {
    "field": "amount",
    "question": "Qual foi o valor gasto no mercado?"
  },
  "response_message": "Qual foi o valor gasto no mercado?"
}
```

---

## Tratamento de Erros

### Valores Monetários

O prompt da IA inclui regras específicas para evitar erros de conversão:

1. Valores são SEMPRE em centavos na API
2. "50 reais" = 5000 centavos
3. "5000" sem contexto = IA pergunta se são R$ 5000 ou R$ 50
4. Despesas são negativas, receitas são positivas

### Fallbacks

- Se a IA não entender: `operation: general_response`
- Se faltar dado crítico: `operation: clarify`
- Se API falhar: Mensagem de erro amigável

### Logs

Todos os nós Code incluem `console.log` para debug:

```javascript
console.log(`[c2f] Operação: ${operation}`);
console.log(`[c2f] Dados: ${JSON.stringify(data)}`);
```

---

## Testes

### Testar Webhook Manualmente

```bash
curl -X POST "https://n8n.tenryu.com.br/webhook-test/c2f-whatsapp-v2" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "test123"
      },
      "pushName": "Teste",
      "message": {
        "conversation": "quanto tenho de saldo?"
      },
      "messageTimestamp": "1706180000"
    }
  }'
```

### Testar Operações API

```bash
# Categorização
curl -X POST "https://c2finance.tenryu.com.br/api/n8n/operations" \
  -H "x-n8n-api-key: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "categorize",
    "phone_number": "5511999999999",
    "data": {
      "description": "Uber viagem",
      "amount": -2500
    }
  }'

# Criar transação
curl -X POST "https://c2finance.tenryu.com.br/api/n8n/operations" \
  -H "x-n8n-api-key: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "create_transaction",
    "phone_number": "5511999999999",
    "data": {
      "description": "Teste WhatsApp",
      "amount_cents": -5000,
      "posted_at": "2026-01-25",
      "category_name": "Testes"
    }
  }'
```

---

## Monitoramento

### Métricas Recomendadas

1. **Latência do workflow**: Tempo entre receber webhook e enviar resposta
2. **Taxa de erros**: Quantas execuções falham
3. **Tokens LLM**: Monitorar custo da Groq
4. **Operações por tipo**: Quantas transações, consultas, etc.

### Alertas Sugeridos

- Workflow em erro por mais de 5 minutos
- Latência média > 10 segundos
- Taxa de erro > 5%

---

## Manutenção

### Atualizar Workflow

1. Desative o workflow atual
2. Exporte como backup
3. Importe a nova versão
4. Ative e teste

### Limpar Buffer (se necessário)

O buffer de mensagens está em memória. Para limpar:

1. Reinicie o workflow (desativar/ativar)
2. Ou adicione um endpoint de limpeza manual

---

## Troubleshooting

### Mensagens não chegam

1. Verificar webhook no Evolution API
2. Verificar se o workflow está ativo
3. Verificar logs no n8n

### IA não entende corretamente

1. Verificar prompt no nó "Preparar Prompt da IA"
2. Ajustar temperatura do LLM (atual: 0.2)
3. Adicionar mais exemplos no prompt

### Valores incorretos

1. Verificar conversão centavos ↔ reais
2. Verificar se IA está seguindo regras do prompt
3. Adicionar validação no backend

### Usuário não verificado

1. Verificar se o número está cadastrado no c2Finance
2. Verificar se a verificação foi concluída
3. Verificar formato do número (55XXXXXXXXXXX)

---

## Changelog

### v2.0.0 (2026-01-25)

- Adicionado message buffering (3s delay)
- Expandido suporte a orçamentos, metas, dívidas
- Melhorado prompt da IA para parsing de valores
- Adicionado endpoint unificado `/api/n8n/operations`
- Categorização automática usando histórico
- Logs estruturados em todos os nós
