import type { Visit } from '@/domain/entities/visit';
import type { VisitId, FieldId } from '@/domain/shared/ids';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import { isSameCalendarDay } from '@/domain/shared/date-utils';

export class InMemoryVisitRepository implements VisitRepository {
  private readonly visits = new Map<VisitId, Visit>();

  async save(visit: Visit): Promise<void> {
    this.visits.set(visit.id, visit);
  }

  async findById(id: VisitId): Promise<Visit | null> {
    return this.visits.get(id) ?? null;
  }

  async findActiveByFieldOnDay(fieldId: FieldId, day: Date): Promise<Visit | null> {
    for (const visit of this.visits.values()) {
      if (
        visit.fieldId === fieldId &&
        visit.status === 'ACTIVE' &&
        isSameCalendarDay(visit.visitDate, day)
      ) {
        return visit;
      }
    }
    return null;
  }

  async listByField(fieldId: FieldId): Promise<Visit[]> {
    return [...this.visits.values()].filter((visit) => visit.fieldId === fieldId);
  }
}
