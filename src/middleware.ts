// middleware.ts

import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { contextStorage } from "./context";
import { createLogger } from "./logger";
import dotenv from "dotenv";
dotenv.config();

if (process.env.NODE_ENV !== "production" && !process.env.SERVICE_NAME) {
  console.warn(
    "[observability-lib] WARNING: SERVICE_NAME env var not set. " +
      'Logs will use "servico-desconhecido" as service name, making them ' +
      "indistinguishable from other services in Loki/Grafana. " +
      "Set SERVICE_NAME in your .env or docker-compose.yaml.",
  );
}

const logger = createLogger(process.env.SERVICE_NAME || "servico-desconhecido");

// Rotas de infraestrutura (health checks e scraping de métricas) geram ruído
// no Loki sem valor de observabilidade quando estão OK, então só são logadas
// em caso de falha (status >= 400) — sinal de mal funcionamento do serviço.
const LOG_IGNORED_PATHS = new Set(["/health", "/metrics"]);

export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const isInfraPath = LOG_IGNORED_PATHS.has(req.path);

  const correlationId = (req.headers["x-correlation-id"] as string) || uuidv4();

  const store = new Map<string, string>();
  store.set("correlation_id", correlationId);

  contextStorage.run(store, () => {
    const start = Date.now();

    // logger.info({
    //   message: 'Incoming Request',
    //   http: { method: req.method, url: req.originalUrl }
    // });

    res.on("finish", () => {
      if (isInfraPath && res.statusCode < 400) {
        return;
      }

      const latencyMs = Date.now() - start;
      const payload = {
        message: "Request Completed",
        http: {
          method: req.method,
          url: req.originalUrl,
          status_code: res.statusCode,
          latency_ms: latencyMs,
          client_ip: req.ip,
          user_agent: req.headers["user-agent"] || "unknown",
        },
      };

      if (isInfraPath && res.statusCode >= 400) {
        logger.warn(payload);
      } else {
        logger.info(payload);
      }
    });

    next();
  });
};
