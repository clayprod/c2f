# 🔧 Troubleshooting Docker Desktop - WSL Bootstrap Failed

## Erro Encontrado
```
Docker Desktop - WSL bootstrap failed
exit status 0xc00000fd
```

## ✅ Solução Aplicada

1. **Desligar o WSL:**
   ```powershell
   wsl --shutdown
   ```

2. **Reiniciar o Docker Desktop:**
   - Feche completamente o Docker Desktop
   - Aguarde alguns segundos
   - Abra o Docker Desktop novamente
   - Aguarde ele inicializar completamente (ícone da baleia fica verde)

3. **Verificar se está funcionando:**
   ```powershell
   docker ps
   ```

## 🔄 Próximos Passos

Após reiniciar o Docker Desktop:

1. **Aguarde o Docker inicializar completamente** (ícone verde na bandeja)
2. **Teste novamente:**
   ```powershell
   docker-compose -f docker-compose.dev.yml up --build -d
   ```

## 📝 Alternativa: Continuar sem Docker

Se o problema persistir, você pode continuar desenvolvendo sem Docker:

```bash
npm run dev
```

A aplicação funciona perfeitamente sem Docker para desenvolvimento local, com hot reload completo.

## 🐛 Se o Problema Persistir

1. **Coletar diagnósticos:**
   - No Docker Desktop, clique em "Gather diagnostics"
   - Isso criará um arquivo de log para análise

2. **Verificar WSL:**
   ```powershell
   wsl --list --verbose
   ```
   - Verifique se todas as distribuições estão rodando

3. **Reinstalar WSL (último recurso):**
   ```powershell
   wsl --unregister docker-desktop
   wsl --unregister docker-desktop-data
   ```
   - Depois reinicie o Docker Desktop (ele recriará as distribuições)

## ✅ Status Atual

- ✅ Aplicação rodando sem Docker: `http://localhost:3000`
- ✅ Hot reload funcionando
- ⚠️ Docker Desktop com problema no WSL (solução aplicada)


