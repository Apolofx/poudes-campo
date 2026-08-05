import type { VisitMedia } from '@/domain/entities/visit-media';
import type { MediaId, VisitId } from '@/domain/shared/ids';

export interface MediaRepository {
  save(media: VisitMedia): Promise<void>;
  listByVisit(visitId: VisitId): Promise<VisitMedia[]>;
  delete(id: MediaId): Promise<void>;
}
