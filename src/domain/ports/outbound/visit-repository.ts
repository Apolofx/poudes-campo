import type { Visit } from '@/domain/entities/visit';
import type { VisitId, FieldId } from '@/domain/shared/ids';

export interface VisitRepository {
  save(visit: Visit): Promise<void>;
  findById(id: VisitId): Promise<Visit | null>;
  findDoneByFieldOnDay(fieldId: FieldId, day: Date): Promise<Visit | null>;
  listByField(fieldId: FieldId): Promise<Visit[]>;
  findPendingByField(fieldId: FieldId): Promise<Visit | null>;
  findPendings(): Promise<Visit[]>;
}
