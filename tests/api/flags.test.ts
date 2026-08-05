import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

const { evaluate } = vi.hoisted(() => ({ evaluate: vi.fn() }));

vi.mock('@vercel/flags-core', () => ({ flagsClient: { evaluate } }));

import handler from '../../api/flags';

interface MockRes {
  statusCode: number;
  setHeader: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

function makeRes(): MockRes {
  return { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
}

function bodyOf(res: MockRes): Record<string, unknown> {
  expect(res.end).toHaveBeenCalledTimes(1);
  return JSON.parse(res.end.mock.calls[0][0]);
}

describe('api/flags', () => {
  beforeEach(() => {
    evaluate.mockReset();
  });

  it('devuelve el valor de onboardingNuevo evaluado por Vercel', async () => {
    evaluate.mockResolvedValue({ value: true, reason: 'static' });
    const res = makeRes();
    await handler({} as IncomingMessage, res as unknown as ServerResponse);
    expect(bodyOf(res)).toEqual({ onboardingNuevo: true });
  });

  it('devuelve off si la evaluación del flag falla', async () => {
    evaluate.mockRejectedValue(new Error('network'));
    const res = makeRes();
    await handler({} as IncomingMessage, res as unknown as ServerResponse);
    expect(bodyOf(res)).toEqual({ onboardingNuevo: false });
  });
});
