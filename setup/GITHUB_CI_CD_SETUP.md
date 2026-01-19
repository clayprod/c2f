# 🚀 Configuração CI/CD com GitHub Actions e EasyPanel

## 🎯 Objetivo

Automatizar o processo de build, push da imagem Docker para GitHub Container Registry (GHCR) e deploy automático no EasyPanel quando houver push/commit na branch `main`.

## 📋 Fluxo do Pipeline

1. **Lint e Type Check**: Valida código e tipos TypeScript
2. **Build**: Compila a aplicação Next.js
3. **Build e Push Docker**: Cria imagem Docker e faz push para GHCR
4. **Trigger Deploy**: Aciona webhook do EasyPanel para deploy automático

## 🔐 Secrets Necessários no GitHub

Configure os seguintes secrets no repositório GitHub:

### Acessar Secrets no GitHub

1. Vá para o repositório no GitHub
2. Clique em **Settings** → **Secrets and variables** → **Actions**
3. Clique em **New repository secret**

### Secrets Obrigatórios

#### 1. `NEXT_PUBLIC_SUPABASE_URL`
- **Descrição**: URL pública do projeto Supabase
- **Exemplo**: `https://xxxxx.supabase.co`
- **Uso**: Build argument para compilar a aplicação Next.js

#### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Descrição**: Chave pública anônima do Supabase
- **Exemplo**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Uso**: Build argument para compilar a aplicação Next.js

#### 3. `EASYPANEL_WEBHOOK_URL`
- **Descrição**: URL do webhook de deploy do EasyPanel
- **Exemplo**: `https://api.easypanel.io/webhooks/deploy/xxxxx` ou URL customizada
- **Uso**: Acionar deploy automático após push da imagem
- **Nota**: Se não configurado, o pipeline continua mas não aciona deploy

### Secrets Automáticos (não precisa configurar)

- `GITHUB_TOKEN`: Token automático fornecido pelo GitHub Actions para push no GHCR

## 📝 Como Obter o Webhook do EasyPanel

### Opção 1: Webhook Automático do EasyPanel

1. Acesse o EasyPanel Dashboard
2. Vá para o projeto/app `tenryu-c2finance`
3. Procure por **"Webhooks"** ou **"Deploy Hooks"** nas configurações
4. Copie a URL do webhook de deploy
5. Adicione como secret `EASYPANEL_WEBHOOK_URL` no GitHub

### Opção 2: Webhook Customizado

Se o EasyPanel não fornecer webhook automático, você pode:

1. Criar um endpoint customizado que acione o deploy
2. Ou usar a API do EasyPanel diretamente (se disponível)
3. Configurar o webhook URL no secret `EASYPANEL_WEBHOOK_URL`

## 🏷️ Tags da Imagem Docker

O workflow cria as seguintes tags no GHCR:

- `main-<sha>`: Tag com SHA do commit (ex: `main-abc123def456`)
- `latest`: Tag estável apontando para o último commit da main

### Exemplo de uso no EasyPanel

No EasyPanel, configure o container para usar:
```
ghcr.io/<seu-usuario>/<seu-repo>:latest
```

Ou para uma versão específica:
```
ghcr.io/<seu-usuario>/<seu-repo>:main-<sha>
```

## 🔄 Como Funciona

### Trigger Automático

O workflow é acionado automaticamente quando:
- Há push/commit na branch `main`
- Você executa manualmente via **Actions** → **Build and Deploy** → **Run workflow**

### Etapas do Pipeline

1. **Lint and Type Check** (Job 1)
   - Instala dependências
   - Executa `npm run lint`
   - Executa `npm run type-check`
   - Se falhar, o pipeline para

2. **Build Application** (Job 2)
   - Instala dependências
   - Executa `npm run build` com variáveis de ambiente
   - Se falhar, o pipeline para

3. **Build and Push Docker Image** (Job 3)
   - Faz login no GHCR usando `GITHUB_TOKEN`
   - Cria tags da imagem (SHA + latest)
   - Faz build da imagem Docker com build args
   - Faz push para GHCR
   - Usa cache do GitHub Actions para acelerar builds

4. **Trigger EasyPanel Deploy** (Job 4)
   - Envia POST para webhook do EasyPanel
   - Inclui informações do commit (ref, sha, repository)
   - Se `EASYPANEL_WEBHOOK_URL` não estiver configurado, apenas avisa e continua

## 🐛 Troubleshooting

### Problema: Build falha com erro de variáveis de ambiente

**Solução:**
- Verifique se `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão configurados nos secrets
- Verifique se os valores estão corretos (sem espaços extras)

### Problema: Push para GHCR falha com erro de permissão

**Solução:**
- Verifique se o repositório tem permissão de escrita para packages
- Vá em **Settings** → **Actions** → **General** → **Workflow permissions**
- Certifique-se de que **Read and write permissions** está habilitado

### Problema: Webhook do EasyPanel não é acionado

**Solução:**
- Verifique se `EASYPANEL_WEBHOOK_URL` está configurado nos secrets
- Verifique se a URL do webhook está correta
- Verifique os logs do workflow na aba **Actions** do GitHub
- Teste o webhook manualmente com curl:
  ```bash
  curl -X POST "$EASYPANEL_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d '{"ref": "refs/heads/main", "sha": "test", "repository": "user/repo"}'
  ```

### Problema: Imagem não aparece no GHCR

**Solução:**
- Verifique se o repositório está público ou você tem acesso
- Vá para **Packages** no repositório GitHub
- Verifique se a imagem foi criada com o nome correto: `ghcr.io/<usuario>/<repo>`

### Problema: Deploy no EasyPanel não acontece automaticamente

**Solução:**
- Verifique se o EasyPanel está configurado para escutar o webhook
- Verifique se o container no EasyPanel está configurado para usar a imagem do GHCR
- Verifique se o EasyPanel tem permissão para fazer pull da imagem (pode precisar de token de acesso)

## 📚 Configuração do EasyPanel

### Configurar Container para Usar Imagem do GHCR

1. No EasyPanel, vá para o app `tenryu-c2finance`
2. Vá para **"Image"** ou **"Docker Image"**
3. Configure a imagem como:
   ```
   ghcr.io/<seu-usuario>/<seu-repo>:latest
   ```
4. Configure autenticação se necessário:
   - Crie um Personal Access Token no GitHub com permissão `read:packages`
   - Configure como secret no EasyPanel
   - Use como username: `<seu-usuario>` e password: `<token>`

### Configurar Auto-Deploy

1. No EasyPanel, procure por **"Auto Deploy"** ou **"Webhooks"**
2. Configure o webhook para aceitar requisições do GitHub Actions
3. Copie a URL do webhook e configure como `EASYPANEL_WEBHOOK_URL` no GitHub

## ✅ Checklist de Configuração

- [ ] Secrets configurados no GitHub:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `EASYPANEL_WEBHOOK_URL` (opcional)
- [ ] Permissões do workflow configuradas (Read and write permissions)
- [ ] Container no EasyPanel configurado para usar imagem do GHCR
- [ ] Webhook do EasyPanel configurado (se aplicável)
- [ ] Teste manual do workflow executado com sucesso
- [ ] Push na main testado e deploy funcionando

## 🚀 Testando o Pipeline

### Teste Manual

1. Vá para **Actions** no repositório GitHub
2. Clique em **Build and Deploy**
3. Clique em **Run workflow**
4. Selecione a branch `main`
5. Clique em **Run workflow**
6. Monitore a execução nas abas de cada job

### Teste com Push

1. Faça uma alteração qualquer no código
2. Commit e push para `main`:
   ```bash
   git add .
   git commit -m "test: CI/CD pipeline"
   git push origin main
   ```
3. Vá para **Actions** e monitore o workflow
4. Verifique se a imagem foi criada no GHCR
5. Verifique se o deploy foi acionado no EasyPanel

## 📖 Referências

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Buildx](https://docs.docker.com/buildx/)
- [EasyPanel Documentation](https://easypanel.io/docs)

