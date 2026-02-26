import pino from 'pino';
import { getCorrelationId } from './context';

export const createLogger = (serviceName: string) => {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    messageKey: 'message', 
    base: {
      service_name: serviceName, 
    },
    timestamp: pino.stdTimeFunctions.isoTime, 
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }), 
    },
    mixin: () => {
      const correlationId = getCorrelationId();
      return correlationId ? { correlation_id: correlationId } : {};
    },

    redact: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.token'],
    serializers: {
      error: pino.stdSerializers.err
    },
  });
};