# c2Finance - Orientações para Qwen Code

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

## Orçamentos Automáticos

### Geração Automática

O sistema gera automaticamente orçamentos para categorias especiais quando configuradas:

- **Goals (Objetivos)**: Quando `include_in_budget = true` e `status = 'active'`, o sistema:
  - Calcula automaticamente `monthly_contribution_cents` baseado em `target_date` e `target_amount_cents` se não fornecido
  - Gera budgets automáticos para próximos 12 meses baseado em `contribution_frequency`
  - Permite ajuste manual via endpoint especial `/api/budgets/[id]/adjust-goal`, que recalcula meses subsequentes

- **Debts (Dívidas)**: Quando `is_negotiated = true` e `include_in_budget = true`:
  - Distribui parcelas nos meses pertinentes baseado em `installment_count` e `installment_day`
  - Ou gera baseado em `contribution_frequency` e `monthly_payment_cents`
  - Apenas dívidas com status 'active', 'negotiating' ou 'negociando' geram budgets

- **Investments (Investimentos)**: Quando `include_in_budget = true` e `status = 'active'`:
  - Gera budgets automáticos baseado em `contribution_frequency` e `monthly_contribution_cents`
  - Valores não saem do saldo atual (são projeções)

- **Credit Cards (Cartões de Crédito)**: Budgets gerados automaticamente via faturas. Bloquear criação manual completamente.

### Bloqueio de Criação/Edição Manual

- **Categorias automáticas**: Não permitir criação manual de budgets para categorias com `source_type` em `['credit_card', 'goal', 'debt', 'investment']`
- **Budgets automáticos**: Não permitir edição manual de budgets com `is_auto_generated = true` (exceto goals via endpoint especial)
- **Mensagens de erro**: Explicar claramente que orçamentos são gerados automaticamente e devem ser ajustados através da entidade correspondente

### Indicadores Visuais

- Mostrar badge "Automático" para budgets gerados automaticamente
- Bloquear edição na UI para budgets automáticos
- Mostrar tooltips explicativos ao tentar editar budget automático

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

## Orçamentos e Projeções

### Sistema Unificado

- **Orçamentos e projeções são a mesma coisa**: ambos usam a tabela `budgets` com campos `source_type` e `is_projected`.
- **Tipos de origem**: `manual`, `credit_card`, `goal`, `debt`, `recurring`, `installment`.
- **Projeções automáticas**: geradas a partir de faturas de cartão, objetivos, dívidas negociadas, transações recorrentes e parceladas.

### Contribuições Automáticas

#### Inclusão no Orçamento

- **Goals**: Campo `include_in_budget` (padrão: `true`) + `contribution_frequency` + `monthly_contribution_cents`.
- **Debts**: Campo `include_in_budget` (padrão: `true`) + `contribution_frequency` + `monthly_payment_cents` (apenas para dívidas negociadas com `is_negotiated = true`).
- **Investments**: Campo `include_in_budget` (padrão: `true`) + `contribution_frequency` + `monthly_contribution_cents`.
- **Transactions**: Campo `contribution_frequency` para transações recorrentes (além de `recurrence_rule` para compatibilidade).

#### Frequências de Aporte

Frequências suportadas: `daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`.

- **Cálculo mensal**: Função `calculateMonthlyTotal()` converte frequência em valor mensal.
- **Inclusão por mês**: Função `shouldIncludeInMonth()` determina se deve incluir em um mês específico baseado na frequência e data de início.

#### Validação de Mínimo

- **Cálculo automático**: `minimum_amount_planned` = soma de todas as contribuições automáticas da categoria.
- **Fontes consideradas**:
  - Transações recorrentes da categoria
  - Goals com `include_in_budget = true`
  - Debts com `include_in_budget = true` e `is_negotiated = true`
  - Investments com `include_in_budget = true`
  - Faturas de cartão de crédito
- **Validação obrigatória**: Orçamento não pode ser reduzido abaixo de `minimum_amount_planned`.
- **Mensagem de erro**: Deve listar todas as fontes que impedem a redução e sugerir ações (ex: desmarcar transação como recorrente).

### Regras de Negócio

#### Criação de Orçamentos

- Ao criar orçamento manual, calcular e definir `minimum_amount_planned` e `auto_contributions_cents`.
- Validar que `amount_planned >= minimum_amount_planned` antes de salvar.
- Se validação falhar, retornar erro com lista de fontes e sugestões.

#### Atualização de Orçamentos

- Ao atualizar `amount_planned`, recalcular `minimum_amount_planned`.
- Validar que novo valor >= mínimo.
- Se tentar reduzir abaixo do mínimo, retornar erro específico com fontes que impedem.

#### Projeções Automáticas

- Geradas pelo serviço `generateProjections()` que consolida:
  - Faturas de cartão de crédito
  - Aportes de objetivos (com `include_in_budget` e frequência)
  - Pagamentos de dívidas negociadas (com `include_in_budget` e frequência)
  - Aportes de investimentos (com `include_in_budget` e frequência)
  - Transações recorrentes (com `contribution_frequency`)
  - Transações parceladas
- Projeções são transformadas em registros `budgets` com `is_projected = true`.

### Compatibilidade e Fallback

- **Migration não aplicada**: Código deve funcionar mesmo sem os novos campos (`minimum_amount_planned`, `auto_contributions_cents`).
- **Fallback**: Tentar inserir/atualizar com novos campos; se falhar com erro de coluna não encontrada, tentar sem eles.
- **Detecção de erro**: Verificar código `42703` (PostgreSQL undefined column) ou mensagem contendo nome da coluna.

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

---

## BoxIcons

- O projeto utiliza a versão gratuita do BoxIcons
- Ao atualizar ou adicionar ícones, é importante verificar se o nome da classe está correto no arquivo CSS do BoxIcons
- Exemplo de correção feita: `bx-category` para `bx-categories` e `bx-bar-chart-alt` para `bx-bar-chart`
- Sempre verificar os nomes exatos dos ícones no arquivo `public/boxicons.min.css` antes de implementar

---

## Missing Business Rules

### Rate Limiting
- A API de projeções tem limitação de taxa: 10 requisições por minuto por usuário
- Implementado com um Map em memória (para ambientes distribuídos, usar Redis ou banco de dados)

### Credit Card Bills
- Faturas de cartão de crédito geram entradas de orçamento automáticas
- O sistema bloqueia a criação manual de orçamentos para categorias de cartão de crédito
- Apenas faturas com status diferente de 'paga' são incluídas nas projeções

### Debt Negotiation Statuses
- Status de dívidas: `active`, `paid`, `overdue`, `paga`, `negociando`, `negociada`
- Apenas dívidas com status `negociada` podem ter frequência e valor de pagamento definidos
- Dívidas negociadas com flag `include_in_budget` geram entradas de orçamento automáticas

### Investment Budget Inclusion
- Investimentos ativos com flag `include_in_budget` geram entradas de orçamento automáticas
- Usam campos `monthly_contribution_cents` e `contribution_frequency` para cálculos

### Asset Depreciation
- Bens podem ter métodos de depreciação: `linear`, `declining_balance`, `none`
- Taxas de depreciação e vida útil em anos são usadas para cálculos

### Installment Transactions
- Transações parceladas são tratadas separadamente de transações recorrentes
- Têm campos específicos `installment_number` e `installment_total`

### Transaction Source Types
- Transações podem ter diferentes origens: `manual`, `pluggy`, `import`
- Isso afeta como são processadas e validadas

### Category Source Types
- Categorias podem ter tipos de origem: `general`, `credit_card`, `investment`, `goal`, `debt`, `asset`
- Isso afeta como orçamentos são criados para essas categorias

### Goal Completion Logic
- Objetivos têm transições de status baseadas na meta vs valor atual
- O sistema atualiza automaticamente o status do objetivo quando a meta é atingida

### Fallback Mechanism for Missing DB Columns
- O sistema tem mecanismo de fallback quando novas colunas de banco de dados não existem
- Tenta inserir/atualizar com novos campos e faz fallback sem eles se a coluna não existir
- Usa código de erro PostgreSQL '42703' para detectar colunas ausentes

### Data Consistency
- Todos os valores monetários devem ser armazenados em centavos (inteiros) no banco de dados
- Conversão para reais (decimais) deve ocorrer apenas para exibição

### Performance Considerations
- O cálculo de valores reais para orçamentos deve ser feito em lote para evitar problemas N+1
- Consultas devem ser otimizadas usando funções de janela quando apropriado

---

## Organização de Documentação

### Estrutura de Diretórios

A documentação do projeto está organizada da seguinte forma:

- **Raiz do projeto**: Arquivos essenciais como `README.md`, `QWEN.md`, `CLAUDE.md`, e arquivos de configuração específicos de IA (`.gemini/`, `.cursor/`, `.claude/`)
- **`/docs`**: Documentação geral do projeto, guias, especificações e recomendações
- **`/setup`**: Documentação de configuração, instalação e variáveis de ambiente
- **`/troubleshooting`**: Documentação de resolução de problemas, erros comuns e soluções

### Regras de Organização

- **Arquivos especiais mantidos na raiz**: `QWEN.md`, `CLAUDE.md`, e quaisquer arquivos de regras específicas de IA (como `cursor-rules.md` se existir)
- **Documentação de setup**: Inclui arquivos como `DEV_SETUP.md`, `ENV_SETUP.md`, `CONFIGURACAO_COMPLETA.md`, `STRIPE_WEBHOOK_SETUP.md`, `EASYPANEL_WEBHOOK_SETUP.md`, etc.
- **Documentação de troubleshooting**: Inclui arquivos como `DOCKER_TROUBLESHOOTING.md`, `PROBLEMAS_IDENTIFICADOS.md`, `PROBLEMAS_VISUAIS_RESOLVIDOS.md`, etc.
- **Documentação geral**: Inclui arquivos como `IMPROVEMENTS.md`, `README_LOGOS.md`, e outros guias ou especificações

### Diretrizes para Adição de Novos Arquivos

- Avalie o tipo de conteúdo e coloque no diretório mais apropriado
- Se for uma nova guideline específica para um modelo de IA, crie na raiz com o nome apropriado (ex: `gemini.md`)
- Se for um guia de configuração, coloque em `/setup`
- Se for uma solução para problemas comuns, coloque em `/troubleshooting`
- Se for documentação geral do projeto, coloque em `/docs`