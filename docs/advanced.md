# Configuração e Tópicos Avançados
 
---
 
## Configuração
 
### SERVICE_NAME
 
Nome do serviço incluído em todos os logs.
 
```env
SERVICE_NAME=pedidos-service
```
 
Essencial para diferenciar logs de múltiplos serviços no mesmo sistema de coleta. Se não definida, o valor padrão `servico-desconhecido` é usado — tornando logs de diferentes serviços indistinguíveis em produção.
 
### LOG_LEVEL
 
Define o nível mínimo de log emitido pelo Pino — logs abaixo desse nível são silenciados:
 
| Valor   | Logs emitidos                    | Indicado para                  |
|---------|----------------------------------|--------------------------------|
| `info`  | info, warn, error, fatal         | Padrão / maioria dos ambientes |
| `warn`  | warn, error, fatal               | Produção com alto volume       |
| `error` | error, fatal                     | Ambientes com foco em alertas  |
 
A hierarquia completa do Pino é: `trace < debug < info < warn < error < fatal`.
 
### Comportamento por ambiente
 
**Desenvolvimento:**
 
```env
SERVICE_NAME=meu-servico-local
```
 
```bash
# LOG_LEVEL inline + pino-pretty para output legível
LOG_LEVEL=info node server.js | npx pino-pretty
```
 
**Produção:**
 
```env
SERVICE_NAME=pedidos-service
```
 
```bash
# LOG_LEVEL via variável de ambiente no deploy
LOG_LEVEL=warn node server.js
```
 
Em produção, os logs JSON puros são enviados ao coletor (Loki, Logstash, etc.) sem formatação adicional, garantindo máxima performance.
 
---
 
## Observabilidade: logs, métricas e tracing
 
Logging é apenas um dos três pilares da observabilidade. Esta biblioteca cobre o pilar de **logs**. Para uma estratégia completa:
 
| Pilar        | O que mede                            | Ferramentas comuns            |
|--------------|---------------------------------------|-------------------------------|
| **Logs**     | Eventos discretos com contexto        | Pino + Loki, ELK Stack        |
| **Métricas** | Valores numéricos ao longo do tempo   | Prometheus + Grafana          |
| **Tracing**  | Latência distribuída por operação     | OpenTelemetry, Jaeger, Zipkin |
 
O `correlation_id` desta biblioteca é compatível com o conceito de `trace_id` em sistemas de tracing distribuído, e pode ser usado como ponto de correlação entre as três fontes de dados.
 
---
 
## Integração com Ferramentas de Observabilidade
 
### Grafana + Loki
 
O Loki ingere logs JSON e permite filtrar por campos estruturados. Com os logs desta biblioteca, queries como a seguinte são possíveis:
 
```logql
{service="pedidos-service"} | json | correlation_id="f47ac10b-58cc-4372-a567-0e02b2c3d479"
```
 
```logql
{service="pedidos-service"} | json | level="ERROR" | http_status_code >= 500
```
 
### ELK Stack (Elasticsearch + Logstash + Kibana)
 
Configure o Logstash para ingerir os logs JSON diretamente via `stdin` ou Filebeat. Os campos estruturados (`level`, `service`, `correlation_id`, `http.status_code`) são automaticamente mapeados como campos Elasticsearch, permitindo dashboards e alertas granulares no Kibana.
 
### Filebeat / Fluentd
 
Use Filebeat ou Fluentd para coletar os logs do `stdout` da aplicação e enviá-los ao destino desejado. Não é necessária nenhuma configuração adicional na biblioteca — os logs já chegam em JSON válido.
 
---
 
## Estratégias de Logging em Microserviços
 
Em arquiteturas com muitos serviços, adote as seguintes práticas:
 
- **Um coletor centralizado:** Todos os serviços enviam logs para o mesmo destino. O campo `service` diferencia a origem.
- **Sempre propague o `correlation_id`:** Configure o interceptor Axios em todos os clientes HTTP da organização, sem exceção.
- **Defina um schema compartilhado:** Publique a estrutura de log esperada como contrato entre equipes, versionado junto com a biblioteca.
- **Alertas baseados em nível:** Configure alertas automáticos para logs `ERROR` e `FATAL`. Logs `WARN` podem compor dashboards de tendência.
 
---
 
## Padronização em Times
 
Para garantir consistência entre equipes:
 
- Centralize a configuração da biblioteca em um pacote interno (`@minha-org/observability`) com opções padrão pré-configuradas.
- Defina um catálogo de mensagens de log padronizadas para eventos comuns (ex: `"Entity not found"`, `"External service timeout"`).
- Inclua a estrutura de log e os helpers como parte do template de novos projetos.
- Realize revisões de código focadas em qualidade de logging: presença de contexto suficiente no `metadata`, uso correto de níveis, ausência de dados sensíveis.
 
---
 
## Versionamento e Evolução do Schema de Logs
 
Trate o schema dos logs como uma API pública:
 
- Adições de novos campos são retrocompatíveis.
- Renomear ou remover campos é uma mudança breaking — comunique com antecedência e mantenha compatibilidade por um ciclo antes de remover.
- Considere incluir um campo `schema_version` nos logs para facilitar migrações em sistemas de coleta:
 
```json
{
  "schema_version": "1.0",
  "level": "INFO",
  "service": "pedidos-service"
}
```
 
---
 
## Performance e Impacto de Logging
 
O Pino é um dos loggers mais performáticos para Node.js, com serialização JSON assíncrona e uso mínimo de CPU. Ainda assim, considere:
 
- **Volume de logs:** Em produção com alto tráfego, `LOG_LEVEL=warn` pode reduzir significativamente o volume sem perder eventos críticos.
- **Metadata pesado:** Evite serializar objetos grandes ou listas extensas no `metadata`. Prefira identificadores e valores escalares.
- **Endpoints de alta frequência:** As rotas `/health` e `/metrics` só geram log pelo `requestLoggerMiddleware` quando falham (`status_code >= 400`) — tráfego de sucesso não gera log de infraestrutura. Para outros endpoints ruidosos, considere sampling (ex: logar 1 em cada 100 requisições).
- **I/O assíncrono:** O Pino escreve no `stdout` de forma assíncrona por padrão, minimizando o impacto no event loop do Node.js.
 
---
 
## Segurança, Redação e LGPD
 
A biblioteca já aplica redação automática via `pino redact` para:
 
- `req.headers.authorization`
- `req.headers.cookie`
- `body.password`
- `body.token`
 
Para cumprir com a LGPD e proteger dados pessoais, estenda essa lista ao usar `createLogger` diretamente:
 
```typescript
import pino from 'pino';
import { getCorrelationId } from '@fcaioss/observability-lib';
 
const logger = pino({
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'body.password',
    'body.token',
    'body.cpf',          // Adicional
    'body.cartao',       // Adicional
    'metadata.email',    // Adicional
  ],
  mixin: () => {
    const correlationId = getCorrelationId();
    return correlationId ? { correlation_id: correlationId } : {};
  },
});
```
 
Além da redação técnica, adote as seguintes práticas organizacionais:
 
- Defina uma política de retenção de logs (ex: 30 dias em dev, 90 dias em produção).
- Restrinja o acesso aos sistemas de log a pessoal autorizado.
- Nunca inclua dados pessoais completos em mensagens de log — use identificadores anonimizados quando possível.
- Documente quais campos são considerados dados pessoais no schema de logs da organização.