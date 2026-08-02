import type { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import type { ScheduledVisitId, FieldId } from '@/domain/shared/ids';

export interface ScheduledVisitRepository {
  save(item: ScheduledVisit): Promise<void>;
  findById(id: ScheduledVisitId): Promise<ScheduledVisit | null>;
  listByField(fieldId: FieldId): Promise<ScheduledVisit[]>;
  findActiveByField(fieldId: FieldId): Promise<ScheduledVisit | null>;
  listActive(): Promise<ScheduledVisit[]>;
}
