import type { MediaRepository } from '@/domain/ports/outbound/media-repository';
import { VisitMedia } from '@/domain/entities/visit-media';
import type { MediaId, VisitId } from '@/domain/shared/ids';

export class InMemoryMediaRepository implements MediaRepository {
  private readonly items = new Map<MediaId, VisitMedia>();

  async save(media: VisitMedia): Promise<void> {
    this.items.set(media.id, media);
  }

  async listByVisit(visitId: VisitId): Promise<VisitMedia[]> {
    return [...this.items.values()].filter((m) => m.visitId === visitId);
  }

  async delete(id: MediaId): Promise<void> {
    this.items.delete(id);
  }

  clear(): void {
    this.items.clear();
  }
}
