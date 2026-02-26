import pino from 'pino';
import { getCorrelationId } from './context';

export const createLogger = (serviceName: string) => {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    
    // 1. Garante que a chave de texto seja "message" em vez de "msg"
    messageKey: 'message', 
    
    // 2. Define o service_name estático para todas as chamadas
    base: {
      service_name: serviceName, 
    },
    
    // 3. Garante o timestamp em formato ISO
    timestamp: pino.stdTimeFunctions.isoTime, 
    
    formatters: {
      // 4. Converte o level para MAIÚSCULO (INFO, WARN, ERROR)
      level: (label) => ({ level: label.toUpperCase() }), 
    },
    
    // 5. Injeta o correlation_id dinamicamente
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