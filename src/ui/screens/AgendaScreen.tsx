// src/ui/screens/AgendaScreen.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgenda } from '@/ui/hooks/use-agenda';
import { groupUpcoming, formatRelativeDays, type GroupBy } from '@/ui/agenda-presentation';
import { ReminderAvisoBanner } from '@/ui/components/ReminderAvisoBanner';
import { clientLabel, zoneLabel } from '@/ui/labels';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'time', label: 'Tiempo' },
  { value: 'zone', label: 'Zona' },
  { value: 'client', label: 'Cliente' },
];

export function AgendaScreen() {
  const { items, loading, error } = useAgenda();
  const [groupBy, setGroupBy] = useState<GroupBy>('time');
  const [showLater, setShowLater] = useState(false);

  const sections = groupUpcoming(items, groupBy);

  return (
    <main className="screen agenda">
      <ReminderAvisoBanner />
      <header className="agenda-header">
        <h1 className="screen-title">Próximas visitas</h1>
        <div className="segmented" role="group" aria-label="Agrupar por">
          {GROUP_OPTIONS.map((opt) => (
            <label className="segment" key={opt.value}>
              <input
                type="radio"
                name="group-by"
                checked={groupBy === opt.value}
                onChange={() => setGroupBy(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </header>

      {loading && <p className="hint">Cargando…</p>}
      {!loading && error && (
        <p className="alert" role="alert">No se pudieron cargar las visitas. Reintentá.</p>
      )}
      {!loading && !error && items.length === 0 && <p className="empty">No hay visitas agendadas.</p>}

      {sections.map((section) => {
        const collapsed = section.bucket === 'LATER' && !showLater;
        return (
          <section className="agenda-section" key={section.key}>
            <h2 className={`agenda-section-title${section.bucket === 'OVERDUE' ? ' is-overdue' : ''}`}>
              {section.label} · {section.items.length}
            </h2>
            {collapsed ? (
              <button className="agenda-more" type="button" onClick={() => setShowLater(true)}>
                Ver {section.items.length} lote{section.items.length === 1 ? '' : 's'}
              </button>
            ) : (
              <ul className="agenda-list">
                {section.items.map((item) => (
                  <li key={item.field.id}>
                      <Link
                      className={`agenda-row${item.urgency.bucket === 'OVERDUE' ? ' is-overdue' : ''}`}
                      to={`/field/${item.field.id}/record`}
                      state={{ back: { label: 'Próximas visitas', to: '/' } }}
                    >
                      <span className="agenda-row-text">
                        <span className="agenda-row-name">{item.field.name}</span>
                        <span className="agenda-row-sub">{clientLabel(item.clientName)} · {zoneLabel(item.zoneName)}</span>
                      </span>
                      <span className="agenda-row-when">{formatRelativeDays(item.urgency.daysUntil)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
