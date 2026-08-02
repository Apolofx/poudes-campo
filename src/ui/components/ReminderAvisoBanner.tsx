import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useCampo } from '@/ui/CampoProvider';
import type { DueReminder } from '@/domain/ports/outbound/reminder-notifier';
import { zoneLabel } from '@/ui/labels';

interface ZoneGroup {
  zoneName: string;
  fieldNames: string[];
}

function groupByZone(batch: DueReminder[]): ZoneGroup[] {
  const byZone = new Map<string, string[]>();
  for (const item of batch) {
    const key = zoneLabel(item.zoneName);
    const names = byZone.get(key) ?? [];
    names.push(item.fieldName);
    byZone.set(key, names);
  }
  return [...byZone.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([zoneName, fieldNames]) => ({ zoneName, fieldNames }));
}

export function ReminderAvisoBanner() {
  const { reminderAviso } = useCampo();
  const [dismissed, setDismissed] = useState(false);

  const batch = reminderAviso.snapshot();
  if (dismissed || batch.length === 0) return null;

  const groups = groupByZone(batch);
  const plural = batch.length === 1 ? 'lote' : 'lotes';

  return (
    <aside className="reminder-aviso" role="status">
      <div className="reminder-aviso-head">
        <span className="reminder-aviso-title">
          <Bell className="reminder-aviso-bell" size={16} aria-hidden="true" />
          {batch.length} {plural} para visitar pronto
        </span>
        <button
          className="reminder-aviso-close"
          type="button"
          aria-label="Cerrar aviso"
          onClick={() => setDismissed(true)}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <ul className="reminder-aviso-list">
        {groups.map((group) => (
          <li key={group.zoneName}>
            <span className="reminder-aviso-zone">{group.zoneName}</span>
            {' — '}
            <span className="reminder-aviso-fields">{group.fieldNames.join(', ')}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
