import { describe, it, expect } from 'vitest';
import { VisitMedia } from '@/domain/entities/visit-media';

describe('VisitMedia', () => {
  it('expone metadatos y los getters por kind', () => {
    const media = new VisitMedia({
      id: 'm1',
      visitId: 'v1',
      kind: 'image',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      createdAt: new Date('2026-08-05T12:00:00Z'),
      blob: new Blob(['1234567890']),
    });
    expect(media.isImage).toBe(true);
    expect(media.isVoice).toBe(false);
    expect(media.sizeBytes).toBe(10);
    expect(media.blob.size).toBe(10);
    expect(media.visitId).toBe('v1');
  });

  it('distingue una nota de voz', () => {
    const media = new VisitMedia({
      id: 'm2',
      visitId: 'v1',
      kind: 'voice',
      mimeType: 'audio/webm',
      sizeBytes: 3,
      createdAt: new Date('2026-08-05T12:00:00Z'),
      blob: new Blob(['abc']),
    });
    expect(media.isVoice).toBe(true);
    expect(media.isImage).toBe(false);
  });
});
