# Pluggy Integration

Integração opcional com Pluggy/MeuPluggy para conciliação bancária via Open Finance.

## Fluxo de Conexão

1. Usuário com plano Business acessa `/app/integration`
2. Frontend chama `POST /api/pluggy/connect-token`
3. Backend verifica plano, cria connect token via Pluggy API
4. Frontend inicializa Pluggy Connect Widget com o token
5. Usuário seleciona instituição e concede consentimento
6. Pluggy envia webhook `ITEM_UPDATED` para `POST /api/pluggy/callback`
7. Backend processa webhook, cria/atualiza `pluggy_items`, dispara sync inicial
8. Sync busca accounts → cria `pluggy_accounts` → busca transactions → dedupe → cria `pluggy_transactions`

## Estrutura de Dados

- **pluggy_items**: Representam conexões bancárias (item_id, connector_id, status, execution_status)
- **pluggy_accounts**: Contas bancárias vinculadas a um Item
- **pluggy_transactions**: Transações de uma Account (com hash para dedupe)
- **pluggy_sync_logs**: Logs de cada execução de sincronização

## Sincronização

- **Idempotente**: pode reexecutar sem duplicar dados
- **Dedupe**: por `pluggy_transaction_id` (preferencial) OU `hash` (date + amount_cents + description normalizada)
- **Paginação**: Transactions podem ter paginação, buscar todas páginas automaticamente
- **Retry/backoff**: em falhas da API Pluggy (exponential backoff)
- **Rate limit**: respeitar limites da API Pluggy (429 Too Many Requests)

## Endpoints

- `POST /api/pluggy/connect-token` - Cria connect token (requer plano Business)
- `POST /api/pluggy/callback` - Webhook handler para eventos Pluggy
- `GET /api/pluggy/items` - Lista conexões do usuário
- `GET /api/pluggy/items/:itemId/accounts` - Lista contas de um item
- `GET /api/pluggy/items/:itemId/transactions` - Lista transações de um item
- `POST /api/pluggy/sync/:itemId` - Reexecuta sincronização manual
- `DELETE /api/pluggy/items/:itemId` - Revoga conexão

## Limitações

- Apenas usuários com plano Business podem usar Pluggy
- App funciona 100% sem Pluggy (integração é opcional)
- Nunca logar payload bancário completo (apenas IDs e metadados)

## Variáveis de Ambiente

```
PLUGGY_CLIENT_ID=your_client_id
PLUGGY_CLIENT_SECRET=your_client_secret
PLUGGY_BASE_URL=https://api.pluggy.ai (ou sandbox)
```





