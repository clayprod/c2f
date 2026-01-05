# Logos do c2Finance

## Arquivos necessários

Coloque os seguintes arquivos nesta pasta:

- `logo-primary.png` - Logo principal "HELLO" estilizado
- `logo-light.png` - Logo branco (para fundos escuros)
- `logo-dark.png` - Logo preto (para fundos claros)

## Uso nos componentes

Os componentes já estão configurados para usar os logos através do helper `@/lib/logo`:

```typescript
import { getLogo } from '@/lib/logo';

// Logo automático (primary)
const logo = getLogo('auto');

// Logo para tema claro
const logo = getLogo('light');

// Logo para tema escuro
const logo = getLogo('dark');
```

## Componentes que usam logo

- `src/components/app/AppLayout.tsx` - Sidebar da aplicação
- `src/components/landing/Navbar.tsx` - Navegação da landing page





