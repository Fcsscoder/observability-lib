// logger.ts

import pino from 'pino';
import { contextStorage } from './context';

export const createLogger = (serviceName: string) => {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    messageKey: 'message', 
    base: {
      service: serviceName, 
    },
    timestamp: pino.stdTimeFunctions.isoTime, 
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }), 
    },
    // Uma única leitura do store por log: correlation_id e installation_id vêm
    // do mesmo contexto, e cada campo só entra no payload quando existe.
    mixin: () => {
      const store = contextStorage.getStore();
      const correlationId = store?.get('correlation_id');
      const installationId = store?.get('installation_id');
      return {
        ...(correlationId && { correlation_id: correlationId }),
        ...(installationId && { installation_id: installationId }),
      };
    },

    redact: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.token'],
    serializers: {
      error: pino.stdSerializers.err
    },
  });
};