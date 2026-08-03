import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpReminderFeedRepository } from '@/infrastructure/persistence/http/reminder-feed-repository';
import type { PendingVisitFeedItem } from '@/domain/ports/outbound/reminder-feed-repository';

const items: PendingVisitFeedItem[] = [
  { visitId: 'v1', fieldId: 'f1', fieldName: 'A', plannedFor: '2026-08-01T00:00:00.000Z', reminderLeadDays: 3 },
];

describe('HttpReminderFeedRepository', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hace PUT a /v1/pending-visits con bearer, content-type y body JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const repo = new HttpReminderFeedRepository('https://api.campo.app', 'secret');

    await repo.replace(items);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.campo.app/v1/pending-visits');
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer secret' });
    expect(init.body).toBe(JSON.stringify(items));
  });

  it('con respuesta 204 resuelve sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
    const repo = new HttpReminderFeedRepository('https://api.campo.app', 'secret');

    await expect(repo.replace(items)).resolves.toBeUndefined();
  });

  it('lanza si el servidor responde error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const repo = new HttpReminderFeedRepository('https://api.campo.app', 'secret');

    await expect(repo.replace(items)).rejects.toThrow('reminder feed: HTTP 401');
  });
});
