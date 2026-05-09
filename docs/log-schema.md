# Estrutura dos Logs, Boas Práticas e Tratamento de Erros
 
---
 
## Estrutura dos Logs
 
Todos os logs são emitidos em formato JSON com os seguintes campos:
 
| Campo            | Tipo     | Descrição                                                                    |
|------------------|----------|------------------------------------------------------------------------------|
| `level`          | `string` | Nível do log em maiúsculas: `INFO`, `WARN`, `ERROR`, `FATAL`                 |
| `time`           | `string` | Timestamp ISO 8601 (ex: `2024-01-15T10:30:00.000Z`)                          |
| `service`        | `string` | Nome do serviço definido em `SERVICE_NAME`                                   |
| `correlation_id` | `string` | UUID da requisição, injetado automaticamente via `mixin` do Pino             |
| `message`        | `string` | Descrição do evento (chave `message`, não `msg`)                             |
| `http`           | `object` | Dados HTTP da requisição/resposta (ver detalhes abaixo)                      |
| `metadata`       | `object` | Dados adicionais específicos do contexto, passados via helpers               |
| `error`          | `object` | Detalhes do erro, serializado via `pino.stdSerializers.err`                  |
 
### Campos do objeto `http`
 
| Campo         | Presente em                       | Descrição                        |
|---------------|-----------------------------------|----------------------------------|
| `method`      | Todos os logs HTTP                | Método HTTP (`GET`, `POST`, ...) |
| `url`         | Todos os logs HTTP                | URL da requisição                |
| `status_code` | Log de saída (middleware)         | Código HTTP da resposta          |
| `latency_ms`  | Log de saída (middleware)         | Tempo total de processamento     |
| `client_ip`   | Log de saída e helpers (`logInfo`, `logWarn`, `logError`, `logFatal`) | IP do cliente |
| `user_agent`  | Log de saída e helpers (`logInfo`, `logWarn`, `logError`, `logFatal`) | User-Agent do cliente |
 
---
 
## Exemplos de Logs
 
### Log de entrada (INFO)
 
Gerado automaticamente pelo middleware ao receber a requisição.
 
```json
{
  "level": "INFO",
  "time": "2024-01-15T10:30:00.123Z",
  "service": "pedidos-service",
  "correlation_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "message": "Incoming Request",
  "http": {
    "method": "POST",
    "url": "/pedidos"
  }
}
```
 
### Log de negócio (INFO com metadata)
 
Gerado pelo controller via `logInfo`.
 
```json
{
  "level": "INFO",
  "time": "2024-01-15T10:30:00.456Z",
  "service": "pedidos-service",
  "correlation_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "message": "Pedido criado com sucesso",
  "http": {
    "method": "POST",
    "url": "/pedidos",
    "client_ip": "192.168.1.100",
    "user_agent": "axios/1.6.0"
  },
  "metadata": {
    "pedido_id": "PED-9823",
    "valor_total": 149.90,
    "itens": 3
  }
}
```
 
### Log de saída (INFO com latência)
 
Gerado automaticamente pelo middleware quando a resposta é enviada.
 
```json
{
  "level": "INFO",
  "time": "2024-01-15T10:30:00.789Z",
  "service": "pedidos-service",
  "correlation_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "message": "Request Completed",
  "http": {
    "method": "POST",
    "url": "/pedidos",
    "status_code": 201,
    "latency_ms": 312,
    "client_ip": "192.168.1.100",
    "user_agent": "axios/1.6.0"
  }
}
```
 
### Log de validação (WARN)
 
```json
{
  "level": "WARN",
  "time": "2024-01-15T10:31:00.100Z",
  "service": "pedidos-service",
  "correlation_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Tentativa de pedido com estoque insuficiente",
  "http": {
    "method": "POST",
    "url": "/pedidos"
  },
  "metadata": {
    "produto_id": "SKU-456",
    "quantidade_solicitada": 10,
    "estoque_disponivel": 3
  }
}
```
 
### Log de erro (ERROR)
 
```json
{
  "level": "ERROR",
  "time": "2024-01-15T10:32:00.200Z",
  "service": "pedidos-service",
  "correlation_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "message": "Falha ao consultar estoque no serviço externo",
  "http": {
    "method": "POST",
    "url": "/pedidos"
  },
  "error": {
    "type": "Error",
    "message": "connect ECONNREFUSED 10.0.0.5:8080",
    "stack": "Error: connect ECONNREFUSED...\n    at ..."
  },
  "metadata": {
    "endpoint": "http://estoque-service/api/consultar"
  }
}
```
 
---
 
## Boas Práticas
 
### Nunca logar dados sensíveis
 
A biblioteca já redacta automaticamente `req.headers.authorization`, `req.headers.cookie`, `body.password` e `body.token`. Revise sempre o `metadata` passado nos helpers para garantir que CPFs, cartões de crédito e outros dados pessoais não sejam incluídos.
 
```typescript
// Errado
logInfo(req, 'Usuário autenticado', { senha: req.body.password, cpf: req.body.cpf });
 
// Correto
logInfo(req, 'Usuário autenticado', { usuario_id: usuario.id });
```
 
### Sempre use helpers nos controllers, não o logger diretamente
 
Os helpers garantem que `method`, `url` e a estrutura padrão estejam sempre presentes. Usar `createLogger` diretamente nos controllers produz logs inconsistentes que dificultam queries e alertas.
 
### Não duplique logs entre middleware e controller
 
O middleware já loga `"Incoming Request"` e `"Request Completed"`. Evite recriar esses logs nos controllers.
 
```typescript
// Desnecessário — o middleware já faz isso
logInfo(req, 'Requisição recebida');
 
// Logue apenas eventos de negócio
logInfo(req, 'Usuário encontrado na base', { usuario_id: user.id });
```
 
### Use o nível correto de log
 
- Use `warn` para validações e anomalias, não para erros técnicos.
- Use `error` para exceções capturadas que impactam o usuário.
- Reserve `fatal` para falhas que comprometem a disponibilidade do serviço.
- Não use `info` para eventos de erro — isso oculta problemas em ferramentas de alerta.
 
### Inclua contexto suficiente no `metadata`
 
Logs sem contexto são inúteis em produção. Sempre inclua identificadores relevantes (`pedido_id`, `usuario_id`, `produto_id`) que permitam reproduzir o cenário.
 
### Mantenha consistência de nomenclatura
 
Defina convenções de nomenclatura para chaves do `metadata` no time (ex: sempre `snake_case`, sempre usar `_id` como sufixo para identificadores). Isso facilita queries em ferramentas como Grafana Loki ou Elasticsearch.
 
---
 
## Tratamento de Erros
 
### Erros recuperáveis com `logError`
 
Use `logError` dentro de blocos `try/catch` para registrar falhas que afetam uma requisição mas não derrubam o serviço:
 
```typescript
import { logError, logInfo } from '@fcaioss/observability-lib';
 
async function processarPagamento(req: Request, res: Response) {
  try {
    const resultado = await servicoPagamento.processar(req.body);
    logInfo(req, 'Pagamento processado', { transacao_id: resultado.id });
    res.status(200).json(resultado);
  } catch (err) {
    logError(req, 'Falha no processamento do pagamento', err, {
      gateway: 'stripe',
      valor: req.body.valor,
    });
    res.status(500).json({ error: 'Erro ao processar pagamento' });
  }
}
```
 
O parâmetro `error` é serializado pelo `pino.stdSerializers.err`, que extrai automaticamente `type`, `message` e `stack` do objeto de erro.
 
### Erros críticos com `logFatal`
 
Use `logFatal` para falhas que comprometem a operação do serviço e normalmente exigem reinicialização ou intervenção manual:
 
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
 
Para erros fatais **sem `req` disponível** (ex: falha durante a inicialização):
 
```typescript
import { createLogger } from '@fcaioss/observability-lib';
 
async function conectarBancoDeDados() {
  try {
    await db.connect();
  } catch (err) {
    const logger = createLogger(process.env.SERVICE_NAME || 'servico');
    logger.fatal({ message: 'Falha crítica ao conectar ao banco de dados', error: err });
    process.exit(1);
  }
}
```
 
### Passando instâncias de `Error` corretamente
 
O serializer do Pino espera uma instância de `Error`. Evite passar strings ou objetos planos no parâmetro `error`:
 
```typescript
// Correto — preserva type, message e stack trace
} catch (err) {
  logError(req, 'Falha na integração', err);
}
 
// Evitar — perde o stack trace
} catch (err) {
  logError(req, 'Falha na integração', String(err));
}
```
 