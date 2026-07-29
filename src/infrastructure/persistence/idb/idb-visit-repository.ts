import type { VisitRepository, CurrentFollowUp } from '@/domain/ports/outbound/visit-repository';
import type { Visit } from '@/domain/entities/visit';
import type { VisitId, FieldId } from '@/domain/shared/ids';
import { isSameCalendarDay } from '@/domain/shared/date-utils';
import type { CampoDb } from './open-campo-db';
import { toVisitRecord, fromVisitRecord, type VisitRecord } from './records';

export class IdbVisitRepository implements VisitRepository {
  constructor(private readonly db: CampoDb) {}

  async save(visit: Visit): Promise<void> {
    await this.db.put('visits', toVisitRecord(visit));
  }

  async findById(id: VisitId): Promise<Visit | null> {
    const record = await this.db.get('visits', id);
    return record ? fromVisitRecord(record) : null;
  }

  async findActiveByFieldOnDay(fieldId: FieldId, day: Date): Promise<Visit | null> {
    const records = await this.db.getAllFromIndex('visits', 'by-field', fieldId);
    const match = records.find(
      (r) => r.status === 'ACTIVE' && isSameCalendarDay(r.visitDate, day),
    );
    return match ? fromVisitRecord(match) : null;
  }

  async listByField(fieldId: FieldId): Promise<Visit[]> {
    const records = await this.db.getAllFromIndex('visits', 'by-field', fieldId);
    return records.map(fromVisitRecord);
  }

  async findCurrentFollowUps(): Promise<CurrentFollowUp[]> {
    const records = await this.db.getAll('visits');
    const latestByField = new Map<string, VisitRecord>();
    for (const r of records) {
      if (r.status !== 'ACTIVE') continue;
      const current = latestByField.get(r.fieldId);
      if (!current || r.createdAt.getTime() > current.createdAt.getTime()) {
        latestByField.set(r.fieldId, r);
      }
    }
    const result: CurrentFollowUp[] = [];
    for (const r of latestByField.values()) {
      if (r.followUp) {
        result.push({ fieldId: r.fieldId, nextVisitDate: r.followUp.nextVisitDate });
      }
    }
    return result;
  }
}
