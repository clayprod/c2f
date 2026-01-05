# Instruções para Favicon

## Onde colocar o favicon

No Next.js 14 com App Router, o favicon deve ser colocado na pasta `public/` na raiz do projeto.

## Arquivo necessário

Coloque o arquivo de favicon como:
- `public/favicon.ico` - Favicon principal

## Formatos adicionais (opcional)

Para melhor suporte em diferentes dispositivos, você pode adicionar:

- `public/apple-touch-icon.png` - Ícone para dispositivos Apple (180x180px)
- `public/favicon-16x16.png` - Favicon 16x16 pixels
- `public/favicon-32x32.png` - Favicon 32x32 pixels

## Configuração

O favicon já está configurado no `src/app/layout.tsx` através dos metadados. O Next.js automaticamente serve arquivos da pasta `public/` na raiz do site.

Após adicionar o arquivo `favicon.ico` na pasta `public/`, ele será automaticamente usado pelo navegador.





