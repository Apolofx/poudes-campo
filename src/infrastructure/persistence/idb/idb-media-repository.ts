import type { MediaRepository } from '@/domain/ports/outbound/media-repository';
import type { VisitMedia } from '@/domain/entities/visit-media';
import type { MediaId, VisitId } from '@/domain/shared/ids';
import type { CampoDb } from './open-campo-db';
import { toMediaRecord, fromMediaRecord } from './records';

export class IdbMediaRepository implements MediaRepository {
  constructor(private readonly db: CampoDb) {}

  async save(media: VisitMedia): Promise<void> {
    await this.db.put('media', toMediaRecord(media));
  }

  async listByVisit(visitId: VisitId): Promise<VisitMedia[]> {
    const records = await this.db.getAllFromIndex('media', 'by-visit', visitId);
    return records.map(fromMediaRecord);
  }

  async delete(id: MediaId): Promise<void> {
    await this.db.delete('media', id);
  }
}
