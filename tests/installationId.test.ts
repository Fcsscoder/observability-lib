import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

import { requestLoggerMiddleware } from '../src/middleware';
import { getInstallationId, getCorrelationId } from '../src/context';

/**
 * O `X-Installation-Id` vem do cliente e não é confiável. Estas duas
 * propriedades são o que separa telemetria útil de um vetor de log injection:
 * só UUID v4 canônico entra no contexto, e um header inválido nunca derruba a
 * requisição — ela segue sem o campo (R8).
 */

const UUID_V4 = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/** Roda o middleware com os headers dados e devolve o que o contexto capturou. */
function captureContext(headers: Record<string, unknown>) {
  const req = { headers, path: '/posts/news', method: 'GET', originalUrl: '/posts/news', ip: '::1' };
  const res = { on: vi.fn(), statusCode: 200 };
  let captured: { installationId?: string; correlationId?: string } = {};

  const next: NextFunction = () => {
    captured = { installationId: getInstallationId(), correlationId: getCorrelationId() };
  };

  requestLoggerMiddleware(req as unknown as Request, res as unknown as Response, next);
  return captured;
}

describe('installation_id no contexto de requisição', () => {
  it('captura um UUID v4 válido', () => {
    expect(captureContext({ 'x-installation-id': UUID_V4 }).installationId).toBe(UUID_V4);
  });

  it('normaliza para minúsculas', () => {
    expect(captureContext({ 'x-installation-id': UUID_V4.toUpperCase() }).installationId).toBe(
      UUID_V4
    );
  });

  it('ignora o header ausente sem afetar o correlation_id', () => {
    const captured = captureContext({});
    expect(captured.installationId).toBeUndefined();
    expect(captured.correlationId).toBeTruthy();
  });

  it.each([
    ['texto arbitrário', 'nao-e-uuid'],
    ['UUID de outra versão', '3f2504e0-4f89-11d3-9a0c-0305e82c3301'],
    ['variante inválida', '3f2504e0-4f89-41d3-0a0c-0305e82c3301'],
    ['string vazia', ''],
    ['payload de log injection', '"}\n{"level":"ERROR","message":"forjado'],
    ['acima de 64 bytes', 'a'.repeat(65)],
  ])('descarta %s', (_caso, valor) => {
    expect(captureContext({ 'x-installation-id': valor }).installationId).toBeUndefined();
  });

  it('descarta valor não-string (header repetido vira array)', () => {
    expect(captureContext({ 'x-installation-id': [UUID_V4, UUID_V4] }).installationId).toBeUndefined();
  });

  it('deixa a requisição seguir mesmo com header inválido', () => {
    const next = vi.fn();
    const req = { headers: { 'x-installation-id': 'lixo' }, path: '/health', method: 'GET', originalUrl: '/health', ip: '::1' };
    const res = { on: vi.fn(), statusCode: 200 };

    requestLoggerMiddleware(req as unknown as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
