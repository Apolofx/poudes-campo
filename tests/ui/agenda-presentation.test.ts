// tests/ui/agenda-presentation.test.ts
import { describe, it, expect } from 'vitest';
import { groupUpcoming, formatRelativeDays } from '@/ui/agenda-presentation';
import type { UpcomingVisit } from '@/application/use-cases/list-upcoming-visits';
import { VisitUrgency } from '@/domain/value-objects/visit-urgency';
import { Field } from '@/domain/entities/field';

const now = new Date('2026-07-28T00:00:00Z');
const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function item(id: string, next: string, zoneName: string, clientName: string): UpcomingVisit {
  return {
    field: new Field({ id, name: `L-${id}`, clientId: 'c', zoneId: 'z' }),
    clientName, zoneName,
    nextVisitDate: at(next),
    urgency: VisitUrgency.of(at(next), now),
  };
}

// Ya vienen ordenados por urgencia (como los devuelve el caso de uso).
const items = [
  item('a', '2026-07-23', 'La Costa', 'Pérez'),      // OVERDUE
  item('b', '2026-07-30', 'El Séptimo', 'Pérez'),    // THIS_WEEK
  item('c', '2026-08-30', 'La Costa', 'Díaz'),       // LATER
];

describe('groupUpcoming (time)', () => {
  it('bucketea en orden fijo y omite secciones vacías', () => {
    const sections = groupUpcoming([items[0], items[1]], 'time'); // sin LATER
    expect(sections.map((s) => s.bucket)).toEqual(['OVERDUE', 'THIS_WEEK']);
    expect(sections[0].label).toBe('Vencidas');
    expect(sections[0].items.map((i) => i.field.id)).toEqual(['a']);
  });
});

describe('groupUpcoming (zone)', () => {
  it('agrupa por zona alfabéticamente y preserva el orden de urgencia dentro', () => {
    const sections = groupUpcoming(items, 'zone');
    expect(sections.map((s) => s.label)).toEqual(['El Séptimo', 'La Costa']);
    expect(sections[1].bucket).toBeUndefined();
    expect(sections[1].items.map((i) => i.field.id)).toEqual(['a', 'c']); // a (overdue) antes que c
  });

  it('groups orphan fields under "Sin zona" and sorts that group last', () => {
    const items = [
      { field: { id: 'a' }, zoneName: 'Norte', clientName: 'X', urgency: { bucket: 'THIS_WEEK', daysUntil: 1 } },
      { field: { id: 'b' }, zoneName: undefined, clientName: 'X', urgency: { bucket: 'THIS_WEEK', daysUntil: 2 } },
    ] as any;
    const sections = groupUpcoming(items, 'zone');
    expect(sections.map((s) => s.label)).toEqual(['Norte', 'Sin zona']);
  });
});

describe('formatRelativeDays', () => {
  it('formatea hoy / pasado / futuro', () => {
    expect(formatRelativeDays(0)).toBe('hoy');
    expect(formatRelativeDays(-5)).toBe('hace 5 d');
    expect(formatRelativeDays(2)).toBe('en 2 d');
  });
});
