import { describe, it, expect } from 'vitest';
import { AttachMediaToVisit } from '@/application/use-cases/attach-media';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryMediaRepository } from '@/infrastructure/persistence/in-memory/in-memory-media-repository';
import { Visit } from '@/domain/entities/visit';
import { VisitNotFound, MediaRequiresDoneVisit, MediaTooLarge } from '@/domain/shared/errors';
import { FixedClock } from '../support/fixed-clock';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';

function doneVisit(overrides: Partial<ConstructorParameters<typeof Visit>[0]> = {}) {
  return new Visit({
    id: 'v1',
    fieldId: 'f1',
    status: 'DONE',
    visitedAt: new Date('2026-08-01T00:00:00Z'),
    createdAt: new Date('2026-07-31T00:00:00Z'),
    ...overrides,
  });
}

function build() {
  const visits = new InMemoryVisitRepository();
  const media = new InMemoryMediaRepository();
  const clock = new FixedClock(new Date('2026-08-05T12:00:00Z'));
  const ids = new IncrementingIdGenerator();
  const uc = new AttachMediaToVisit(media, visits, clock, ids);
  return { uc, visits, media };
}

describe('AttachMediaToVisit', () => {
  it('adjunta una imagen a una visita realizada', async () => {
    const { uc, visits, media } = build();
    await visits.save(doneVisit());
    const blob = new Blob(['img'], { type: 'image/jpeg' });

    const result = await uc.execute({ visitId: 'v1', kind: 'image', mimeType: 'image/jpeg', blob });

    expect(result.visitId).toBe('v1');
    expect(result.kind).toBe('image');
    expect(result.sizeBytes).toBe(blob.size);
    expect(result.createdAt.getTime()).toBe(new Date('2026-08-05T12:00:00Z').getTime());
    expect(await media.listByVisit('v1')).toHaveLength(1);
  });

  it('adjunta una nota de voz', async () => {
    const { uc, visits } = build();
    await visits.save(doneVisit());
    const result = await uc.execute({ visitId: 'v1', kind: 'voice', mimeType: 'audio/webm', blob: new Blob(['voz']) });
    expect(result.isVoice).toBe(true);
  });

  it('rechaza una visita inexistente', async () => {
    const { uc } = build();
    await expect(uc.execute({ visitId: 'nope', kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['x']) }))
      .rejects.toBeInstanceOf(VisitNotFound);
  });

  it('rechaza una visita programada', async () => {
    const { uc, visits } = build();
    await visits.save(
      doneVisit({ id: 'v2', status: 'PENDING', visitedAt: undefined, plannedFor: new Date('2026-09-01T00:00:00Z'), reminderLeadDays: 3 }),
    );
    await expect(uc.execute({ visitId: 'v2', kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['x']) }))
      .rejects.toBeInstanceOf(MediaRequiresDoneVisit);
  });

  it('rechaza una visita cancelada', async () => {
    const { uc, visits } = build();
    await visits.save(
      doneVisit({ id: 'v3', status: 'CANCELLED', visitedAt: undefined, cancelledAt: new Date('2026-08-02T00:00:00Z') }),
    );
    await expect(uc.execute({ visitId: 'v3', kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['x']) }))
      .rejects.toBeInstanceOf(MediaRequiresDoneVisit);
  });

  it('rechaza una imagen mayor a 5 MB', async () => {
    const { uc, visits } = build();
    await visits.save(doneVisit());
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
    await expect(uc.execute({ visitId: 'v1', kind: 'image', mimeType: 'image/jpeg', blob: big }))
      .rejects.toBeInstanceOf(MediaTooLarge);
  });

  it('rechaza una voz mayor a 8 MB', async () => {
    const { uc, visits } = build();
    await visits.save(doneVisit());
    const big = new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]);
    await expect(uc.execute({ visitId: 'v1', kind: 'voice', mimeType: 'audio/webm', blob: big }))
      .rejects.toBeInstanceOf(MediaTooLarge);
  });
});
