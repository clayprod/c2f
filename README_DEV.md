# 🚀 Guia Rápido - Desenvolvimento Local

## Início Rápido

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto com todas as variáveis necessárias (veja `env.example`)

### 3. Rodar em desenvolvimento

**Opção A: Sem Docker (Mais rápido)**
```bash
npm run dev
```

**Opção B: Com Docker**
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### 4. Acessar aplicação
Abra: `http://localhost:3000`

## ✅ Hot Reload

- ✅ Funciona automaticamente
- ✅ Mudanças em arquivos são detectadas instantaneamente
- ✅ Não precisa reiniciar o servidor

## 🧪 Testar

```bash
# Health check
curl http://localhost:3000/api/health

# Ver logs
# (No terminal onde rodou npm run dev ou docker-compose logs -f)
```

## 📝 Próximos Passos

1. Verificar se não há erros no terminal
2. Testar endpoints principais
3. Verificar se hot reload está funcionando (faça uma mudança e veja se reflete)
4. Corrigir erros conforme aparecem

## 🐛 Problemas?

Veja `DEV_SETUP.md` para troubleshooting detalhado.


