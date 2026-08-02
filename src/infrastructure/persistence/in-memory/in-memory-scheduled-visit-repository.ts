import type { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import type { ScheduledVisitId, FieldId } from '@/domain/shared/ids';
import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';

export class InMemoryScheduledVisitRepository implements ScheduledVisitRepository {
  private readonly items = new Map<ScheduledVisitId, ScheduledVisit>();

  async save(item: ScheduledVisit): Promise<void> {
    this.items.set(item.id, item);
  }

  async findById(id: ScheduledVisitId): Promise<ScheduledVisit | null> {
    return this.items.get(id) ?? null;
  }

  async listByField(fieldId: FieldId): Promise<ScheduledVisit[]> {
    return [...this.items.values()].filter((item) => item.fieldId === fieldId);
  }

  async findActiveByField(fieldId: FieldId): Promise<ScheduledVisit | null> {
    for (const item of this.items.values()) {
      if (item.fieldId === fieldId && item.status === 'ACTIVE') return item;
    }
    return null;
  }

  async listActive(): Promise<ScheduledVisit[]> {
    return [...this.items.values()].filter((item) => item.status === 'ACTIVE');
  }

  clear(): void {
    this.items.clear();
  }
}
