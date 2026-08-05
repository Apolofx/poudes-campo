import { describe, it, expect } from 'vitest';
import { RemoveMediaFromVisit } from '@/application/use-cases/remove-media';
import { InMemoryMediaRepository } from '@/infrastructure/persistence/in-memory/in-memory-media-repository';
import { VisitMedia } from '@/domain/entities/visit-media';

describe('RemoveMediaFromVisit', () => {
  it('borra un adjunto existente', async () => {
    const repo = new InMemoryMediaRepository();
    await repo.save(
      new VisitMedia({ id: 'm1', visitId: 'v1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 3, createdAt: new Date(), blob: new Blob(['abc']) }),
    );

    await new RemoveMediaFromVisit(repo).execute('m1');

    expect(await repo.listByVisit('v1')).toHaveLength(0);
  });

  it('borrar un id inexistente es no-op', async () => {
    const repo = new InMemoryMediaRepository();
    await expect(new RemoveMediaFromVisit(repo).execute('nope')).resolves.toBeUndefined();
  });
});
