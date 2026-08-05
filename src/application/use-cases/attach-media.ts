import type { MediaRepository } from '@/domain/ports/outbound/media-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { MediaId, VisitId } from '@/domain/shared/ids';
import { VisitMedia, type MediaKind } from '@/domain/entities/visit-media';
import { VisitNotFound, MediaRequiresDoneVisit, MediaTooLarge } from '@/domain/shared/errors';

const MAX_BYTES: Record<MediaKind, number> = {
  image: 5 * 1024 * 1024,
  voice: 8 * 1024 * 1024,
};

export interface AttachMediaInput {
  visitId: VisitId;
  kind: MediaKind;
  mimeType: string;
  blob: Blob;
}

export class AttachMediaToVisit {
  constructor(
    private readonly media: MediaRepository,
    private readonly visits: VisitRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: AttachMediaInput): Promise<VisitMedia> {
    if (input.blob.size > MAX_BYTES[input.kind]) {
      throw new MediaTooLarge('media exceeds the size cap for its kind');
    }
    const visit = await this.visits.findById(input.visitId);
    if (!visit) throw new VisitNotFound(`unknown visit ${input.visitId}`);
    if (visit.status !== 'DONE') throw new MediaRequiresDoneVisit('media can only be attached to a done visit');

    const media = new VisitMedia({
      id: this.ids.next() as MediaId,
      visitId: input.visitId,
      kind: input.kind,
      mimeType: input.mimeType,
      sizeBytes: input.blob.size,
      createdAt: this.clock.now(),
      blob: input.blob,
    });
    await this.media.save(media);
    return media;
  }
}
