import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import type { ScheduledVisitId, FieldId } from '@/domain/shared/ids';
import type { CampoDb } from './open-campo-db';
import { toScheduledVisitRecord, fromScheduledVisitRecord } from './records';

export class IdbScheduledVisitRepository implements ScheduledVisitRepository {
  constructor(private readonly db: CampoDb) {}

  async save(item: ScheduledVisit): Promise<void> {
    await this.db.put('scheduled-visits', toScheduledVisitRecord(item));
  }

  async findById(id: ScheduledVisitId): Promise<ScheduledVisit | null> {
    const record = await this.db.get('scheduled-visits', id);
    return record ? fromScheduledVisitRecord(record) : null;
  }

  async listByField(fieldId: FieldId): Promise<ScheduledVisit[]> {
    const records = await this.db.getAllFromIndex('scheduled-visits', 'by-field', fieldId);
    return records.map(fromScheduledVisitRecord);
  }

  async findActiveByField(fieldId: FieldId): Promise<ScheduledVisit | null> {
    const records = await this.db.getAllFromIndex('scheduled-visits', 'by-field', fieldId);
    const match = records.find((r) => r.status === 'ACTIVE');
    return match ? fromScheduledVisitRecord(match) : null;
  }

  async listActive(): Promise<ScheduledVisit[]> {
    const records = await this.db.getAll('scheduled-visits');
    return records.filter((r) => r.status === 'ACTIVE').map(fromScheduledVisitRecord);
  }
}
