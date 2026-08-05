import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbMediaRepository } from '@/infrastructure/persistence/idb/idb-media-repository';
import { VisitMedia } from '@/domain/entities/visit-media';

async function freshRepo() {
  const db = await openCampoDb(`t-media-${Math.random()}`);
  return { db, repo: new IdbMediaRepository(db) };
}

function item(id: string, visitId: string, kind: 'image' | 'voice' = 'image', createdAt = new Date('2026-08-01T00:00:00Z')) {
  return new VisitMedia({
    id, visitId, kind, mimeType: kind === 'image' ? 'image/jpeg' : 'audio/webm',
    sizeBytes: 3, createdAt, blob: new Blob(['abc'], { type: kind === 'image' ? 'image/jpeg' : 'audio/webm' }),
  });
}

describe('IdbMediaRepository', () => {
  it('guarda y lista por visita (por index)', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(item('m1', 'v1'));
    await repo.save(item('m2', 'v1', 'voice'));
    await repo.save(item('m3', 'v2'));

    const list = await repo.listByVisit('v1');
    expect(list.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(list[0].blob.size).toBe(3);
    expect(list[1].isVoice).toBe(true);
    db.close();
  });

  it('borra un adjunto', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(item('m1', 'v1'));
    await repo.delete('m1');
    expect(await repo.listByVisit('v1')).toEqual([]);
    db.close();
  });

  it('persiste el blob y el mimeType fielmente', async () => {
    const { db, repo } = await freshRepo();
    const media = new VisitMedia({
      id: 'm1', visitId: 'v1', kind: 'voice', mimeType: 'audio/webm;codecs=opus',
      sizeBytes: 5, createdAt: new Date('2026-08-02T00:00:00Z'), blob: new Blob(['hola!'], { type: 'audio/webm;codecs=opus' }),
    });
    await repo.save(media);
    const [back] = await repo.listByVisit('v1');
    expect(back.mimeType).toBe('audio/webm;codecs=opus');
    expect(back.blob.type).toBe('audio/webm;codecs=opus');
    expect(back.blob.size).toBe(5);
    db.close();
  });
});
