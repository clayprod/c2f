# 🐳 Executando a Aplicação em Modo Dev com Docker

## Pré-requisitos

1. **Docker Desktop** instalado e rodando
2. Arquivo `.env` configurado (baseado em `env.example`)

## Execução Rápida

### 1. Iniciar a aplicação

```bash
docker-compose -f docker-compose.dev.yml up --build
```

### 2. Acessar a aplicação

- **URL**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

### 3. Parar a aplicação

```bash
docker-compose -f docker-compose.dev.yml down
```

## Comandos Úteis

### Ver logs em tempo real
```bash
docker-compose -f docker-compose.dev.yml logs -f
```

### Rebuild completo (limpar cache)
```bash
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up
```

### Entrar no container
```bash
docker-compose -f docker-compose.dev.yml exec app sh
```

### Ver status dos containers
```bash
docker-compose -f docker-compose.dev.yml ps
```

## Hot Reload

O hot reload está configurado e funciona automaticamente:
- Alterações no código são detectadas automaticamente
- O Next.js recarrega a aplicação sem precisar rebuildar o container
- Volumes montados: código fonte (`./`) excluindo `node_modules` e `.next`

## Troubleshooting

### Porta 3000 já em uso
```bash
# Parar processo na porta 3000 (Windows PowerShell)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Ou alterar a porta no docker-compose.dev.yml
ports:
  - "3001:3000"  # Usar porta 3001 no host
```

### Problemas com node_modules
```bash
# Limpar volumes e rebuildar
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up --build
```

### Verificar variáveis de ambiente
```bash
docker-compose -f docker-compose.dev.yml exec app env | grep NEXT_PUBLIC
```

## Estrutura Docker

- **Dockerfile.dev**: Imagem de desenvolvimento com Node.js 20 Alpine
- **docker-compose.dev.yml**: Orquestração com volumes para hot reload
- **next.config.js**: Configurado para polling (necessário no Docker)

## Notas

- O modo `standalone` do Next.js está desabilitado em desenvolvimento
- O healthcheck usa Node.js nativo (não precisa de wget/curl)
- Variáveis de ambiente são carregadas do arquivo `.env`

