import { describe, it, expect } from 'vitest';
import { ListVisitMedia } from '@/application/use-cases/list-visit-media';
import { InMemoryMediaRepository } from '@/infrastructure/persistence/in-memory/in-memory-media-repository';
import { VisitMedia } from '@/domain/entities/visit-media';

function item(id: string, visitId: string, createdAt: Date): VisitMedia {
  return new VisitMedia({ id, visitId, kind: 'image', mimeType: 'image/jpeg', sizeBytes: 3, createdAt, blob: new Blob(['abc']) });
}

describe('ListVisitMedia', () => {
  it('devuelve lista vacía sin adjuntos', async () => {
    const repo = new InMemoryMediaRepository();
    expect(await new ListVisitMedia(repo).execute('v1')).toEqual([]);
  });

  it('devuelve solo los adjuntos de esa visita ordenados por createdAt', async () => {
    const repo = new InMemoryMediaRepository();
    await repo.save(item('m1', 'v1', new Date('2026-08-01T00:00:00Z')));
    await repo.save(item('m2', 'v1', new Date('2026-08-05T00:00:00Z')));
    await repo.save(item('m3', 'v2', new Date('2026-08-03T00:00:00Z')));

    const list = await new ListVisitMedia(repo).execute('v1');
    expect(list.map((m) => m.id)).toEqual(['m1', 'm2']);
  });
});
