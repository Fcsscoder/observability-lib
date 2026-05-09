// integration.ts

/**
 * Valida variáveis de ambiente obrigatórias/recomendadas.
 * Chame no startup do serviço para detectar problemas de configuração antes de ir a produção.
 *
 * @example
 * import { validateIntegration } from '@fcaioss/observability-lib';
 * validateIntegration(); // Imprime warnings em DEV se algo estiver faltando
 */
export const validateIntegration = (): { valid: boolean; warnings: string[] } => {
  const warnings: string[] = [];

  if (!process.env.SERVICE_NAME) {
    warnings.push(
      'SERVICE_NAME not set — logs will appear as "servico-desconhecido" in Loki/Grafana. ' +
      'Fix: add SERVICE_NAME=my-service to .env or docker-compose.yaml.'
    );
  }

  if (!process.env.NODE_ENV) {
    warnings.push(
      'NODE_ENV not set — some behavior (e.g. dev warnings) may not work as expected. ' +
      'Fix: add NODE_ENV=production (or development) to your environment.'
    );
  }

  if (warnings.length > 0) {
    warnings.forEach((w) => console.warn(`[observability-lib] WARNING: ${w}`));
  }

  return { valid: warnings.length === 0, warnings };
};
