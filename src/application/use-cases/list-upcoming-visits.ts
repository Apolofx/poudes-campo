import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { Field } from '@/domain/entities/field';
import { VisitUrgency } from '@/domain/value-objects/visit-urgency';

export interface UpcomingVisit {
  field: Field;
  clientName?: string;
  zoneName?: string;
  nextVisitDate: Date;
  urgency: VisitUrgency;
}

export class ListUpcomingVisits {
  constructor(
    private readonly fields: FieldRepository,
    private readonly visits: VisitRepository,
    private readonly scheduled: ScheduledVisitRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<UpcomingVisit[]> {
    const [followUps, hierarchy, schedules] = await Promise.all([
      this.visits.findCurrentFollowUps(),
      this.fields.listAllWithHierarchy(),
      this.scheduled.listActive(),
    ]);
    const byId = new Map(hierarchy.map((h) => [h.field.id, h]));
    const scheduledByField = new Map(schedules.map((s) => [s.fieldId, s]));
    const now = this.clock.now();

    const items: UpcomingVisit[] = [];
    for (const fu of followUps) {
      if (scheduledByField.has(fu.fieldId)) continue;
      const h = byId.get(fu.fieldId);
      if (!h) continue;
      items.push({
        field: h.field,
        clientName: h.clientName,
        zoneName: h.zoneName,
        nextVisitDate: fu.nextVisitDate,
        urgency: VisitUrgency.of(fu.nextVisitDate, now),
      });
    }
    for (const s of schedules) {
      const h = byId.get(s.fieldId);
      if (!h) continue;
      items.push({
        field: h.field,
        clientName: h.clientName,
        zoneName: h.zoneName,
        nextVisitDate: s.scheduledDate,
        urgency: VisitUrgency.of(s.scheduledDate, now),
      });
    }
    items.sort((a, b) => a.urgency.daysUntil - b.urgency.daysUntil);
    return items;
  }
}
