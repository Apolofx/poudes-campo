import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { ReminderFeedRepository, PendingVisitFeedItem } from '@/domain/ports/outbound/reminder-feed-repository';

export class SyncPendingVisitsFeed {
  constructor(
    private readonly visits: VisitRepository,
    private readonly fields: FieldRepository,
    private readonly feed: ReminderFeedRepository,
  ) {}

  async execute(): Promise<void> {
    const [pendings, catalog] = await Promise.all([this.visits.findPendings(), this.fields.listAllForCatalog()]);
    const byId = new Map(catalog.map((row) => [row.field.id, row]));

    const items: PendingVisitFeedItem[] = pendings.map((v) => {
      const row = byId.get(v.fieldId);
      return {
        visitId: v.id,
        fieldId: v.fieldId,
        fieldName: row?.field.name ?? 'Lote',
        clientName: row?.clientName,
        zoneName: row?.zoneName,
        plannedFor: v.plannedFor?.toISOString() ?? '',
        reminderLeadDays: v.reminderLeadDays ?? 0,
        notes: v.notes,
      };
    });
    await this.feed.replace(items);
  }
}
