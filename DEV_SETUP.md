# 🚀 Setup para Desenvolvimento Local com Hot Reload

## ✅ Pré-requisitos

- Node.js 20+ instalado
- Docker e Docker Compose instalados
- Arquivo `.env` configurado com todas as variáveis necessárias

## 📋 Opções para Rodar Localmente

### Opção 1: Sem Docker (Mais Rápido para Desenvolvimento)

```bash
# 1. Instalar dependências
npm install

# 2. Criar arquivo .env (copiar do .env.example e preencher)
cp .env.example .env
# Edite o .env com suas variáveis

# 3. Rodar em modo desenvolvimento
npm run dev
```

A aplicação estará disponível em: `http://localhost:3000`

### Opção 2: Com Docker (Recomendado para consistência)

```bash
# 1. Criar arquivo .env (se ainda não tiver)
# Edite o .env com suas variáveis

# 2. Rodar com docker-compose para desenvolvimento
docker-compose -f docker-compose.dev.yml up --build

# Ou em background:
docker-compose -f docker-compose.dev.yml up -d --build
```

A aplicação estará disponível em: `http://localhost:3000`

## 🔥 Hot Reload

### Sem Docker:
- ✅ Hot reload funciona automaticamente com `npm run dev`
- ✅ Mudanças em arquivos são detectadas automaticamente

### Com Docker:
- ✅ Hot reload configurado via volumes
- ✅ Mudanças em arquivos são sincronizadas automaticamente
- ✅ Next.js detecta mudanças e recarrega

## 🧪 Testar Endpoints

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Testar Webhook (deve retornar erro de autenticação, mas endpoint funciona)
```bash
curl -X POST http://localhost:3000/api/billing/webhook \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 🐛 Debugging

### Ver Logs (Docker)
```bash
docker-compose -f docker-compose.dev.yml logs -f
```

### Ver Logs (Sem Docker)
Os logs aparecem diretamente no terminal onde você rodou `npm run dev`

### Verificar Erros de TypeScript
```bash
npm run type-check
```

### Verificar Erros de Lint
```bash
npm run lint
```

## 📝 Variáveis de Ambiente Necessárias

Certifique-se de que o arquivo `.env` contém:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Stripe (pode usar test keys para desenvolvimento)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_BUSINESS=price_...

# Groq
GROQ_API_KEY=...

# Pluggy (opcional)
PLUGGY_CLIENT_ID=...
PLUGGY_CLIENT_SECRET=...
PLUGGY_BASE_URL=https://api.pluggy.ai

# App
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🔧 Troubleshooting

### Problema: Porta 3000 já em uso

**Solução:**
```bash
# Verificar o que está usando a porta
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Ou mudar a porta no .env
PORT=3001
```

### Problema: Hot reload não funciona no Docker

**Soluções:**
1. Verificar se os volumes estão montados corretamente
2. Verificar se `WATCHPACK_POLLING=true` está no docker-compose.dev.yml
3. Reiniciar o container: `docker-compose -f docker-compose.dev.yml restart`

### Problema: Erro de módulo não encontrado

**Solução:**
```bash
# Reinstalar dependências
npm install

# Ou no Docker:
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up --build
```

### Problema: Erro de conexão com Supabase

**Solução:**
1. Verificar se as variáveis do Supabase estão corretas no `.env`
2. Verificar se o Supabase está acessível
3. Verificar se as credenciais estão corretas

## 📚 Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Rodar sem Docker
npm run build            # Build para produção
npm run start            # Rodar build de produção
npm run lint             # Verificar erros de lint
npm run type-check       # Verificar erros de TypeScript

# Docker
docker-compose -f docker-compose.dev.yml up        # Rodar
docker-compose -f docker-compose.dev.yml down      # Parar
docker-compose -f docker-compose.dev.yml logs -f   # Ver logs
docker-compose -f docker-compose.dev.yml restart   # Reiniciar
```

## ✅ Checklist Antes de Começar

- [ ] Node.js 20+ instalado
- [ ] Docker instalado (se usar Docker)
- [ ] Arquivo `.env` criado e configurado
- [ ] Dependências instaladas (`npm install`)
- [ ] Porta 3000 disponível
- [ ] Supabase configurado e acessível
- [ ] Stripe configurado (pode usar test keys)

## 🎉 Pronto!

Agora você pode:
1. Fazer alterações no código
2. Ver as mudanças refletidas automaticamente (hot reload)
3. Verificar erros no terminal/logs
4. Testar endpoints localmente


