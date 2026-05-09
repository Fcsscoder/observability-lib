// logger-helpers.ts

import { Request } from "express";
import { createLogger } from "./logger";

const logger = createLogger(process.env.SERVICE_NAME || "servico-desconhecido");

export type Metadata = Record<string, any>;

const buildLogPayload = (
  req: Request,
  message: string,
  metadata?: Metadata,
) => {
  return {
    message,
    http: {
      method: req.method,
      url: req.originalUrl,
      client_ip: req.ip,
      user_agent: req.headers["user-agent"] || "unknown",
    },
    metadata,
  };
};

// --- Helpers com req (para uso em controllers/middlewares Express) ---

export const logInfo = (req: Request, message: string, metadata?: Metadata): void => {
  logger.info(buildLogPayload(req, message, metadata));
};

export const logWarn = (req: Request, message: string, metadata?: Metadata): void => {
  logger.warn(buildLogPayload(req, message, metadata));
};

// Overloads explícitos para evitar passar { error: err } no lugar de err
export function logError(req: Request, message: string, error: unknown): void;
export function logError(req: Request, message: string, error: unknown, metadata: Metadata): void;
export function logError(
  req: Request,
  message: string,
  error?: unknown,
  metadata?: Metadata,
): void {
  logger.error({
    ...buildLogPayload(req, message, metadata),
    error,
  });
}

export function logFatal(req: Request, message: string, error: unknown): void;
export function logFatal(req: Request, message: string, error: unknown, metadata: Metadata): void;
export function logFatal(
  req: Request,
  message: string,
  error?: unknown,
  metadata?: Metadata,
): void {
  logger.fatal({
    ...buildLogPayload(req, message, metadata),
    error,
  });
}

// --- Helpers de background (para workers, cron jobs, eventos sem req HTTP) ---

export const logInfoBackground = (message: string, metadata?: Metadata): void => {
  logger.info({ message, metadata });
};

export const logWarnBackground = (message: string, metadata?: Metadata): void => {
  logger.warn({ message, metadata });
};

export const logErrorBackground = (message: string, error?: unknown, metadata?: Metadata): void => {
  logger.error({ message, error, metadata });
};

export const logFatalBackground = (message: string, error?: unknown, metadata?: Metadata): void => {
  logger.fatal({ message, error, metadata });
};
