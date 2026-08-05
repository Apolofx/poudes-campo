import type { MediaRepository } from '@/domain/ports/outbound/media-repository';
import { VisitMedia } from '@/domain/entities/visit-media';
import type { VisitId } from '@/domain/shared/ids';

export class ListVisitMedia {
  constructor(private readonly media: MediaRepository) {}

  async execute(visitId: VisitId): Promise<VisitMedia[]> {
    const items = await this.media.listByVisit(visitId);
    return [...items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
