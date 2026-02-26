import { AsyncLocalStorage } from 'async_hooks';
export const contextStorage = new AsyncLocalStorage<Map<string, string>>();

export const getCorrelationId = (): string | undefined => {
  const store = contextStorage.getStore();
  return store?.get('correlation_id');
};