# c2Finance - Orientações do Projeto

## Objetivo do Produto

SaaS de finanças pessoais/empresariais com diferencial: **AI Advisor financeiro orientado a ações**.
Monetização via planos e cobrança recorrente no Stripe.

---

## Servidores MCP (Model Context Protocol)

Este projeto possui servidores MCP configurados que devem ser utilizados para obter informações atualizadas e precisas.

### Quando Usar

- **Sempre consultar os servidores MCP** antes de implementar integrações ou quando houver dúvidas sobre APIs externas
- **Priorizar documentação via MCP** em vez de depender apenas do conhecimento interno do modelo

### Servidores Disponíveis

| Servidor | Uso |
|----------|-----|
| **Context7** | Consultar documentação de APIs externas (Pluggy.ai, Next.js, React, etc.) |
| **Supabase** | Operações de banco, debugging, schema, functions e storage |
| **Stripe** | Documentação e operações de billing/pagamentos |
| **Chrome DevTools** | Debugging, automação e inspeção do navegador |

### Context7 - Documentação de APIs

Usar o Context7 para consultar documentação atualizada de:

- **Pluggy.ai** - API de Open Finance/Banking (endpoints, autenticação, webhooks)
- **Next.js** - Framework React (App Router, Server Components, API Routes)
- **Shadcn/ui** - Componentes de UI
- **Outras bibliotecas** - Qualquer dependência do projeto

**Exemplo de uso**: Antes de implementar a sincronização com Pluggy, consultar a documentação via Context7 para obter os endpoints corretos, formatos de request/response e boas práticas.

### Supabase MCP

Usar para:

- Consultar schema do banco de dados
- Debugging de queries e RLS policies
- Gerenciar storage e functions
- Verificar configurações do projeto

### Stripe MCP

Usar para:

- Documentação de webhooks e eventos
- Estrutura de objetos (Subscription, Invoice, Customer)
- Boas práticas de integração

### Chrome DevTools MCP

Usar para:

- Debugging de erros no navegador em tempo real
- Inspeção de elementos, console e network
- Captura de screenshots e análise visual
- Automação de testes e verificação de UI

**Exemplo de uso**: Ao debugar problemas de layout ou erros de JavaScript no frontend, usar o Chrome DevTools MCP para inspecionar o estado da aplicação diretamente no navegador.

---

## Regras de Código

- Preferir organização por domínios (ex: billing, advisor, transactions, budgets)
- Evitar "god files": módulos pequenos, responsabilidades claras
- Toda entrada externa deve ser validada (schema) e erros devem ser padronizados
- Toda lógica de dinheiro deve usar tipos/precisão correta (não usar float para valores monetários)
- Observabilidade mínima: logs estruturados + rastreio de eventos críticos

---

## Arquitetura e Organização

### Padrão de Módulos

- `/domain/<area>` para regras de negócio
- `/services/<integration>` para integrações externas (stripe, pluggy, supabase)
- `/app` ou `/ui` para interface
- `/server` para rotas/handlers e orquestração

### Regras Práticas

- Separar "read model" (dashboard/insights) de "write model" (CRUD) quando começar a pesar
- Evitar acoplamento do Advisor com UI: Advisor expõe "insights" e "ações sugeridas" como payload estruturado

---

## AI Advisor (Diferencial do SaaS)

### Princípio

O Advisor não é só chat: ele deve produzir recomendações e ações com estrutura.

### Saídas Estruturadas (Obrigatório)

Toda resposta do Advisor deve retornar:

- `summary`: texto curto
- `insights[]`: lista de achados (ex: 'gasto alto em restaurantes')
- `actions[]`: ações sugeridas com tipo + payload (ex: create_transaction, adjust_budget, create_goal)
- `confidence`: baixa/média/alta
- `citations`: referências internas (ids de transações/contas/orçamentos usados)

### Regras de Segurança/Privacidade

- Não expor dados sensíveis no prompt (mascarar descrições quando possível)
- Registrar auditoria das ações sugeridas/aplicadas (quem, quando, o que mudou)

### Produto

- Advisor deve respeitar limites do plano (features, volume, periodicidade)
- Para planos pagos: habilitar análises avançadas (projeções, anomalias, alertas)

---

## Billing/Planos (Stripe)

### Regras de Assinatura

- Fonte da verdade de pagamento é Stripe (subscription, invoice, payment_intent)
- O app mantém espelho: customer_id, subscription_id, status, plan_id, current_period_end

### Webhooks

- Webhook é obrigatório e idempotente (dedupe por event.id)
- Sempre validar assinatura do webhook
- Nunca confiar em dados vindos do client para 'is_premium'

### Controle por Plano

Implementar "feature flags" por plano:

- **Limites**: ex: contas, importações, chamadas do Advisor, sync Pluggy
- **Features**: ex: relatórios, projeções avançadas

O backend deve bloquear features proibidas (não só a UI).

---

## Supabase / Postgres / RLS

### Multi-tenant

- Tudo deve ser isolado por user_id ou org_id (decida 1 padrão e aplique em tudo)
- Tabelas com dados do usuário devem ter owner_id/org_id

### RLS (Row Level Security)

- RLS habilitado por padrão em todas as tabelas do domínio do usuário
- Policies completas: SELECT/INSERT/UPDATE/DELETE
- Nunca usar service role no runtime do client

### Performance

- Índices para colunas de filtro frequente (owner_id, date, category_id, account_id)
- Evitar N+1 e queries duplicadas em dashboard; considerar views/materializações

---

## Pluggy/MeuPluggy (Integração Bancária Opcional)

### Produto

- Integração é opt-in: app deve funcionar 100% sem Pluggy
- Habilitar/limitar por plano (ex: só planos pagos)

### Modelo de Dados Sugerido

- `connections/items`: status, last_sync_at, provider
- `accounts`: mapeamento de conta externa -> conta interna
- `transactions`: id externo + hash para dedupe

### Sincronização

- Idempotente + deduplicação obrigatória
- Retry/backoff em falhas
- Log de sync por execução (para debug e suporte)

---

## CI/CD Docker + GHCR

### Pipeline Mínimo

1. lint + typecheck + tests
2. build
3. docker build
4. push ghcr (tag por SHA e tag estável quando fizer sentido)

### Segurança

- Secrets só via GitHub Secrets/Environments
- Evitar print de env em logs
