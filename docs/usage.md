# Como Utilizar
 
> Guia de uso prático da `@fcaioss/observability-lib`. Para conceitos e fluxo interno, veja o [README](./README.md).
 
---
 
## Middleware
 
O middleware deve ser registrado no Express **antes** de qualquer rota. Ele inicializa o contexto do `AsyncLocalStorage` e é responsável pelos logs de infraestrutura.
 
```typescript
import express from 'express';
import { requestLoggerMiddleware } from '@fcaioss/observability-lib';
 
const app = express();
 
app.use(express.json());
app.use(requestLoggerMiddleware); // Deve vir antes das rotas
 
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
 
app.listen(3000);
```
 
> **Atenção:** Registrar o middleware **após** as rotas fará com que essas requisições não tenham `correlation_id` no contexto e os logs de infraestrutura não sejam gerados.
 
O middleware realiza automaticamente:
 
- Extração ou geração do `correlation_id` (via cabeçalho `X-Correlation-ID` ou `uuidv4()`)
- Inicialização do `AsyncLocalStorage` com o `correlation_id`
- Log de `"Incoming Request"` com `method` e `url`
- Log de `"Request Completed"` com `status_code`, `latency_ms`, `client_ip` e `user_agent` (via evento `finish` da resposta)
 
---
 
## createLogger
 
A função `createLogger(serviceName)` cria uma instância Pino configurada com todas as opções da biblioteca (mixin, redact, formatters, etc.).
 
```typescript
import { createLogger } from '@fcaioss/observability-lib';
 
const logger = createLogger('meu-servico');
logger.info({ message: 'Servidor iniciado', port: 3000 });
```
 
**Quando usar diretamente:**
 
- Para logar eventos de inicialização do servidor (antes de qualquer requisição)
- Para logar eventos de infraestrutura sem uma requisição HTTP associada (ex: conexão com banco de dados, workers)
 
**Quando NÃO usar:**
 
Dentro de controllers ou handlers de rota. Nesses contextos, sempre prefira os helpers (`logInfo`, `logWarn`, etc.) — eles incluem os dados HTTP (`method`, `url`) de forma padronizada e automática.
 
---
 
## Helpers
 
Os helpers constroem o payload de log de forma padronizada, incluindo os dados HTTP da requisição atual. Todos aceitam o objeto `req` do Express como primeiro argumento.
 
---
 
### `logInfo`
 
```typescript
logInfo(req: Request, message: string, metadata?: Record<string, any>): void
```
 
Registra um evento informativo do fluxo normal da aplicação.
 
```typescript
import { logInfo } from '@fcaioss/observability-lib';
 
app.get('/pedidos/:id', async (req, res) => {
  const pedido = await buscarPedido(req.params.id);
  logInfo(req, 'Pedido recuperado com sucesso', { pedido_id: req.params.id });
  res.json(pedido);
});
```
 
**Quando usar:** Confirmação de operações bem-sucedidas, eventos relevantes do fluxo de negócio.
 
---
 
### `logWarn`
 
```typescript
logWarn(req: Request, message: string, metadata?: Record<string, any>): void
```
 
Registra uma situação anômala que não impede a continuidade da operação, mas que merece monitoramento.
 
```typescript
import { logWarn } from '@fcaioss/observability-lib';
 
app.post('/usuarios', async (req, res) => {
  if (!req.body.email) {
    logWarn(req, 'Tentativa de criação de usuário sem e-mail', {
      body_recebido: Object.keys(req.body),
    });
    return res.status(400).json({ error: 'E-mail obrigatório' });
  }
  // ...
});
```
 
**Quando usar:** Validações que falharam, dados ausentes ou inconsistentes, limites de taxa próximos do teto, comportamento inesperado mas recuperável.
 
---
 
### `logError`
 
```typescript
logError(
  req: Request,
  message: string,
  error?: unknown,
  metadata?: Record<string, any>
): void
```
 
Registra um erro que impactou a operação de uma requisição específica.
 
```typescript
import { logError } from '@fcaioss/observability-lib';
 
app.get('/dados', async (req, res) => {
  try {
    const dados = await buscarDadosExternos();
    res.json(dados);
  } catch (err) {
    logError(req, 'Falha ao buscar dados externos', err, {
      endpoint: 'https://api.externa.com/dados',
    });
    res.status(502).json({ error: 'Serviço indisponível' });
  }
});
```
 
**Quando usar:** Exceções capturadas em `try/catch`, falhas de integração com APIs externas, erros de acesso a banco de dados.
 
---
 
### `logFatal`
 
```typescript
logFatal(
  req: Request,
  message: string,
  error?: unknown,
  metadata?: Record<string, any>
): void
```
 
Registra um erro crítico que compromete a disponibilidade do serviço.
 
```typescript
import { logFatal } from '@fcaioss/observability-lib';
 
app.post('/critico', async (req, res) => {
  try {
    await operacaoCritica();
  } catch (err) {
    logFatal(req, 'Falha crítica na operação de pagamento', err, {
      transacao_id: req.body.transacao_id,
    });
    res.status(500).json({ error: 'Erro interno crítico' });
  }
});
```
 
**Quando usar:** Falhas que exigem intervenção imediata, corrupção de dados, indisponibilidade de dependências críticas.
 
> Para erros fatais **sem `req` disponível** (ex: falha na conexão com o banco durante a inicialização), use `createLogger` diretamente e chame `process.exit(1)` após o log.
 
---
 
## Interceptor Axios
 
Para propagar o `correlation_id` em chamadas HTTP para outros serviços, aplique o interceptor na instância Axios:
 
```typescript
import axios from 'axios';
import { applyCorrelationInterceptor } from '@fcaioss/observability-lib';
 
const httpClient = axios.create({
  baseURL: 'https://api.outro-servico.com',
  timeout: 5000,
});
 
applyCorrelationInterceptor(httpClient);
 
export { httpClient };
```
 
A partir desse ponto, toda requisição feita com `httpClient` incluirá automaticamente o cabeçalho `X-Correlation-ID` — **desde que a chamada aconteça dentro do escopo de uma requisição Express com o middleware registrado.**
 
### Propagação entre microserviços
 
```
Serviço A                           Serviço B
---------                           ---------
Recebe req → gera correlation_id
→ logInfo("Processando")
→ httpClient.get("/recurso")  ───→  Recebe X-Correlation-ID
                                    → middleware reutiliza o ID
                                    → log "Incoming Request" com mesmo correlation_id
                                    → logInfo("Recurso encontrado")
                                    ←─ responde
← recebe resposta
→ logInfo("Recurso recebido")
→ responde ao cliente
```
 
Todos os logs dos dois serviços compartilham o mesmo `correlation_id`, permitindo rastrear a transação completa em uma única query no sistema de logs.
 
### Serviços receptores
 
Para que um serviço receptor reutilize corretamente o `correlation_id` vindo de outro serviço, basta ter o `requestLoggerMiddleware` registrado — ele já lê o cabeçalho `X-Correlation-ID` automaticamente.