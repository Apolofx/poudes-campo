import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { Visit } from '@/domain/entities/visit';
import type { VisitId, FieldId } from '@/domain/shared/ids';
import { isSameCalendarDay } from '@/domain/shared/date-utils';
import type { CampoDb } from './open-campo-db';
import { toVisitRecord, fromVisitRecord } from './records';

export class IdbVisitRepository implements VisitRepository {
  constructor(private readonly db: CampoDb) {}

  async save(visit: Visit): Promise<void> {
    await this.db.put('visits', toVisitRecord(visit));
  }

  async findById(id: VisitId): Promise<Visit | null> {
    const record = await this.db.get('visits', id);
    return record ? fromVisitRecord(record) : null;
  }

  async findDoneByFieldOnDay(fieldId: FieldId, day: Date): Promise<Visit | null> {
    const records = await this.db.getAllFromIndex('visits', 'by-field', fieldId);
    const match = records.find(
      (r) => r.status === 'DONE' && r.visitedAt && isSameCalendarDay(r.visitedAt, day),
    );
    return match ? fromVisitRecord(match) : null;
  }

  async listByField(fieldId: FieldId): Promise<Visit[]> {
    const records = await this.db.getAllFromIndex('visits', 'by-field', fieldId);
    return records.map(fromVisitRecord);
  }

  async findPendingByField(fieldId: FieldId): Promise<Visit | null> {
    const records = await this.db.getAllFromIndex('visits', 'by-field', fieldId);
    const match = records.find((r) => r.status === 'PENDING');
    return match ? fromVisitRecord(match) : null;
  }

  async findPendings(): Promise<Visit[]> {
    const records = await this.db.getAll('visits');
    return records.filter((r) => r.status === 'PENDING').map(fromVisitRecord);
  }
}
