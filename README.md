# c2finance - Plataforma de Gestão Financeira

c2finance é uma plataforma de gestão financeira moderna e completa, construída com Next.js e Supabase. Ela oferece um conjunto robusto de ferramentas para ajudar os usuários a rastrear, analisar e otimizar suas finanças.

## Principais Funcionalidades

- **Controle Financeiro Essencial:** Gerencie contas, transações e orçamentos de forma centralizada.
- **Gestão de Assinaturas:** Integração com Stripe para gerenciar faturas e assinaturas.
- **Consultor de IA:** Um "Consultor de IA" integrado com Groq e/ou OpenAI para fornecer insights e recomendações financeiras.
- **Integração Open Banking:** Conecte-se a contas bancárias e sincronize transações automaticamente usando a integração com a Pluggy.
- **Importação de Dados:** Funcionalidade para importar dados financeiros.

## Pilha de Tecnologias

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, Radix UI.
- **Backend:** Next.js API Routes.
- **Banco de Dados e Autenticação:** Supabase (PostgreSQL) com Row Level Security (RLS) para garantir a privacidade dos dados.
- **Serviços Adicionais:** Redis (Upstash) para gerenciamento de sessões de IA.
- **Containerização:** Docker e Docker Compose.

## Começando

### Pré-requisitos

- [Docker](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) (versão 20 ou superior)

### Configuração

1.  **Clone o repositório:**
    ```sh
    git clone <URL_DO_SEU_REPOSITORIO_GIT>
    cd <NOME_DO_SEU_PROJETO>
    ```

2.  **Crie o arquivo de ambiente:**
    Copie o arquivo `env.example` para um novo arquivo chamado `.env` e preencha as variáveis de ambiente com suas credenciais para Supabase, Stripe, provedor de IA (Groq/OpenAI), Pluggy e Redis.
    ```sh
    cp env.example .env
    ```

3.  **Instale as dependências:**
    ```sh
    npm install
    ```

### Executando o Ambiente de Desenvolvimento

Para iniciar o ambiente de desenvolvimento com hot-reloading, use o Docker Compose:

```sh
docker-compose -f docker-compose.dev.yml up --build
```

A aplicação estará disponível em `http://localhost:3000`.

## Deploy

A aplicação é totalmente containerizada. O `Dockerfile` utiliza uma abordagem multi-stage para criar uma imagem otimizada e segura para produção, pronta para ser implantada em qualquer serviço de hospedagem de contêineres.

## Arquitetura

A aplicação utiliza o **App Router** do Next.js para uma arquitetura moderna no frontend e backend. A segurança é um pilar fundamental, com o banco de dados Supabase protegido por **Row Level Security (RLS)**, garantindo que os usuários só possam acessar seus próprios dados. A containerização com Docker assegura um ambiente consistente e replicável tanto para desenvolvimento quanto para produção.empty change
