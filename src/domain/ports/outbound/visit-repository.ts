import type { Visit } from '@/domain/entities/visit';
import type { VisitId, FieldId } from '@/domain/shared/ids';

export interface CurrentFollowUp {
  fieldId: FieldId;
  nextVisitDate: Date;
}

export interface VisitRepository {
  save(visit: Visit): Promise<void>;
  findById(id: VisitId): Promise<Visit | null>;
  findActiveByFieldOnDay(fieldId: FieldId, day: Date): Promise<Visit | null>;
  listByField(fieldId: FieldId): Promise<Visit[]>;
  /**
   * Returns, per field, the nextVisitDate of the latest ACTIVE visit by createdAt
   * when it has a followUp. Ties on identical createdAt are unspecified.
   */
  findCurrentFollowUps(): Promise<CurrentFollowUp[]>;
}
