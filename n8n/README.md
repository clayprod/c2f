# Workflows n8n - c2Finance WhatsApp Integration

## Arquivo

- **c2f-whatsapp-agent.json** - Workflow principal para processar mensagens WhatsApp

## Como Importar

1. Acesse seu n8n (ex: https://n8n.tenryu.com.br)
2. Clique em **Workflows** > **Add Workflow** > **Import from File**
3. Selecione o arquivo `c2f-whatsapp-agent.json`
4. Clique em **Import**

## Configuracao de Credenciais

Apos importar, voce precisa configurar as credenciais:

### 1. c2f n8n API Key (Header Auth)

- **Name:** `c2f n8n API Key`
- **Header Name:** `x-n8n-api-key`
- **Header Value:** (copie do painel admin do c2Finance)

### 2. Evolution API Key (Header Auth)

- **Name:** `Evolution API Key`
- **Header Name:** `apikey`
- **Header Value:** (sua API key da Evolution API)

### 3. Groq API Key (Header Auth) - Para transcricao de audio

- **Name:** `Groq API Key`
- **Header Name:** `Authorization`
- **Header Value:** `Bearer sk-...` (sua API key do Groq)

### 4. OpenAI API Key - Para o AI Agent

- **Type:** OpenAI
- **API Key:** `sk-...` (sua API key da OpenAI)

## Variaveis de Ambiente

Configure no n8n em **Settings** > **Variables**:

| Variavel | Valor | Exemplo |
|----------|-------|---------|
| `C2F_API_URL` | URL base da API c2Finance | `https://app.c2finance.com.br` |
| `EVOLUTION_API_URL` | URL base da Evolution API | `https://evolution.example.com` |
| `EVOLUTION_INSTANCE_NAME` | Nome da instancia WhatsApp | `c2finance` |

## Configurar Webhook na Evolution API

1. No painel da Evolution API, configure o webhook:
   - **URL:** `https://seu-n8n.com/webhook/whatsapp-webhook`
   - **Events:** `MESSAGES_UPSERT`
   - **Secret:** (opcional, configure no c2Finance admin)

2. Ative o workflow no n8n

## Fluxo do Workflow

```
1. Webhook recebe mensagem da Evolution API
   |
2. Filtra: ignora grupos, mensagens do bot
   |
3. Extrai dados: numero, texto, audio URL
   |
4. Se audio: Download + Transcreve com Groq/Whisper
   |
5. Busca contexto do usuario via API c2Finance
   |
6. Se nao verificado: responde pedindo cadastro
   |
7. Se verificado: processa com AI Agent
   |
8. Se intent = criar transacao: chama API c2Finance
   |
9. Envia resposta ao usuario via Evolution API
```

## Testando

1. Certifique-se de que:
   - Usuario tem numero verificado no c2Finance
   - Evolution API esta conectada ao WhatsApp
   - Todas as credenciais estao configuradas

2. Envie uma mensagem de teste:
   - "Gastei 50 reais no mercado"
   - "Qual meu saldo?"
   - "Recebi 1000 de salario"

## Troubleshooting

### Erro "Invalid API key"
- Verifique se a credencial `c2f n8n API Key` esta correta
- Verifique se a API key bate com a configurada no admin

### Erro "User not verified"
- Usuario precisa verificar o numero no app c2Finance
- Acesse: /app/integrations

### Audio nao transcreve
- Verifique credencial do Groq
- Verifique se o modelo `whisper-large-v3` esta disponivel

### Mensagem nao chega
- Verifique webhook URL na Evolution API
- Verifique se o workflow esta ativo
- Verifique logs de execucao no n8n
