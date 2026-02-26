import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { contextStorage } from './context';
import { createLogger } from './logger';
import dotenv from 'dotenv';
dotenv.config()

const logger = createLogger(process.env.SERVICE_NAME || 'servico-desconhecido');

export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();

  const store = new Map<string, string>();
  store.set('correlation_id', correlationId);

  contextStorage.run(store, () => {
    const start = Date.now();

    logger.info({
      message: 'Incoming Request',
      http: { method: req.method, url: req.originalUrl }
    });

    res.on('finish', () => {
      const latencyMs = Date.now() - start;

      logger.info({
        message: 'Request Completed',
        http: {
          method: req.method,
          url: req.originalUrl,
          status_code: res.statusCode,
          latency_ms: latencyMs
        }
      });
    });

    next();
  });
};