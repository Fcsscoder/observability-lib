import { AxiosInstance } from 'axios';
import { getCorrelationId } from './context';

export const applyCorrelationInterceptor = (axiosInstance: AxiosInstance) => {
  axiosInstance.interceptors.request.use((config) => {
    const correlationId = getCorrelationId();
    
    if (correlationId) {
      config.headers['X-Correlation-ID'] = correlationId;
    }
    
    return config;
  });
};