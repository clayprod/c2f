# Logos do c2Finance

## Estrutura de Logos

Os logos devem ser salvos na pasta `public/assets/logos/`:

- `logo-primary.png` - Logo principal "HELLO" estilizado (branco sobre preto)
- `logo-light.png` - Logo branco/claro (para fundos escuros)
- `logo-dark.png` - Logo preto/escuro (para fundos claros)

## Uso

O helper `src/lib/logo.ts` fornece funções para obter o logo correto baseado no tema:

```typescript
import { getLogo, logoConfig } from '@/lib/logo';

// Logo automático baseado no tema
const logo = getLogo('auto'); // Retorna logo-primary

// Logo específico para tema claro
const logo = getLogo('light'); // Retorna logo-dark

// Logo específico para tema escuro
const logo = getLogo('dark'); // Retorna logo-light
```

## Componentes que usam logo

- `src/components/app/AppLayout.tsx` - Sidebar da aplicação
- `src/components/landing/Navbar.tsx` - Navegação da landing page
- Outros componentes conforme necessário

## Próximos passos

1. Salvar os arquivos de logo na pasta `public/assets/logos/`
2. Os componentes já estão preparados para usar os novos logos


