import type { UpcomingVisit } from '@/application/use-cases/list-upcoming-visits';
import type { UrgencyBucket } from '@/domain/value-objects/visit-urgency';

export type GroupBy = 'time' | 'zone' | 'client';

export interface AgendaSection {
  key: string;
  label: string;
  bucket?: UrgencyBucket;
  items: UpcomingVisit[];
}

const ORPHAN_LABEL: Record<Exclude<GroupBy, 'time'>, string> = {
  zone: 'Sin zona',
  client: 'Sin cliente',
};

const TIME_SECTIONS: { bucket: UrgencyBucket; key: string; label: string }[] = [
  { bucket: 'OVERDUE', key: 'overdue', label: 'Vencidas' },
  { bucket: 'THIS_WEEK', key: 'this-week', label: 'Esta semana' },
  { bucket: 'LATER', key: 'later', label: 'Más adelante' },
];

export function groupUpcoming(items: UpcomingVisit[], mode: GroupBy): AgendaSection[] {
  if (mode === 'time') {
    return TIME_SECTIONS
      .map(({ bucket, key, label }) => ({
        key,
        label,
        bucket,
        items: items.filter((i) => i.urgency.bucket === bucket),
      }))
      .filter((s) => s.items.length > 0);
  }

  const orphan = ORPHAN_LABEL[mode];
  const nameOf = (i: UpcomingVisit) => (mode === 'zone' ? i.zoneName : i.clientName) ?? orphan;
  const order: string[] = [];
  const groups = new Map<string, UpcomingVisit[]>();
  for (const item of items) {
    const name = nameOf(item);
    if (!groups.has(name)) {
      groups.set(name, []);
      order.push(name);
    }
    groups.get(name)!.push(item);
  }
  order.sort((a, b) => {
    if (a === orphan) return 1;
    if (b === orphan) return -1;
    return a.localeCompare(b, 'es');
  });
  return order.map((name) => ({ key: `${mode}:${name}`, label: name, items: groups.get(name)! }));
}

export function formatRelativeDays(daysUntil: number): string {
  if (daysUntil === 0) return 'hoy';
  if (daysUntil < 0) return `hace ${Math.abs(daysUntil)} d`;
  return `en ${daysUntil} d`;
}
