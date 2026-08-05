import type { MediaRepository } from '@/domain/ports/outbound/media-repository';
import type { MediaId } from '@/domain/shared/ids';

export class RemoveMediaFromVisit {
  constructor(private readonly media: MediaRepository) {}

  async execute(mediaId: MediaId): Promise<void> {
    await this.media.delete(mediaId);
  }
}
