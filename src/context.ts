// context.ts

import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

export const contextStorage = new AsyncLocalStorage<Map<string, string>>();

export const getCorrelationId = (): string | undefined => {
  const store = contextStorage.getStore();
  return store?.get('correlation_id');
};

/**
 * Executa fn dentro de um contexto com correlation_id definido.
 * Use em workers, cron jobs e eventos assíncronos sem req HTTP.
 *
 * @example
 * runWithCorrelationId(uuidv4(), async () => {
 *   logInfoBackground('Job started', { job: 'email-send' });
 *   await sendEmails();
 *   logInfoBackground('Job finished');
 * });
 */
export const runWithCorrelationId = <T>(
  correlationId: string,
  fn: () => T,
): T => {
  const store = new Map<string, string>();
  store.set('correlation_id', correlationId);
  return contextStorage.run(store, fn);
};

/**
 * Cria um novo correlation_id e executa fn dentro desse contexto.
 * Atalho para runWithCorrelationId(uuidv4(), fn).
 */
export const runWithNewCorrelationId = <T>(fn: () => T): T => {
  return runWithCorrelationId(uuidv4(), fn);
};