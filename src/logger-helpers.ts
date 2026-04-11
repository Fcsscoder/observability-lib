// logger-helpers.ts

import { Request } from "express";
import { createLogger } from "./logger";

const logger = createLogger(process.env.SERVICE_NAME || "servico-desconecido");

type Metadata = Record<string, any>;

const buildLogPayload = (req: Request, message: string, metadata?: Metadata) => {
  return {
    message,
    http: {
      method: req.method,
      url: req.originalUrl,
    },
    metadata,
  };
};

export const logInfo = (req: Request, message: string, metadata?: Metadata) => {
  logger.info(buildLogPayload(req, message, metadata));
};

export const logWarn = (req: Request, message: string, metadata?: Metadata) => {
  logger.warn(buildLogPayload(req, message, metadata));
};

export const logError = (
  req: Request,
  message: string,
  error?: unknown,
  metadata?: Metadata
) => {
  logger.error({
    ...buildLogPayload(req, message, metadata),
    error,
  });
};

// FATAL
export const logFatal = (
  req: Request,
  message: string,
  error?: unknown,
  metadata?: Metadata
) => {
  logger.fatal({
    ...buildLogPayload(req, message, metadata),
    error,
  });
};