// tests/ui/agenda-screen.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { AgendaScreen } from '@/ui/screens/AgendaScreen';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { InMemoryZoneRepository } from '@/infrastructure/persistence/in-memory/in-memory-zone-repository';
import { InMemoryClientRepository } from '@/infrastructure/persistence/in-memory/in-memory-client-repository';
import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { DispatchDueReminders } from '@/application/use-cases/dispatch-due-reminders';
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import type { Container } from '@/composition/container';
import { FixedClock } from '../support/fixed-clock';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';
import { wireCatalogUseCases } from '../support/in-memory-container';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function makeContainer(): Promise<Container> {
  const zoneMap = new Map([['z1', new Zone('z1', 'El Séptimo')], ['z2', new Zone('z2', 'La Costa')]]);
  const clientMap = new Map([['c1', new Client('c1', 'La Querencia')], ['c2', new Client('c2', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zoneMap, clientMap, [
    new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'La Cañada', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f3', name: 'Potrero 4', clientId: 'c2', zoneId: 'z2' }),
  ]);
  const visits = new InMemoryVisitRepository();
  const clock = new FixedClock(at('2026-07-28'));
  const seed = (id: string, fieldId: string, next: string) =>
    visits.save(new Visit({
      id, fieldId, visitDate: at('2026-07-10'), createdAt: at('2026-07-10'),
      followUp: { nextVisitDate: at(next), interval: VisitInterval.ofDays(14) },
    }));
  await seed('v1', 'f1', '2026-07-23'); // vencida 5 d
  await seed('v2', 'f2', '2026-07-30'); // en 2 d
  await seed('v3', 'f3', '2026-08-30'); // en 33 d (LATER)
  const reminders = new InMemoryReminderRepository();
  const notifier = new InAppReminderNotifier();
  const ids = new IncrementingIdGenerator();
  const zones = new InMemoryZoneRepository(zoneMap);
  const clients = new InMemoryClientRepository(clientMap);
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, reminders, clock, ids),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
    dispatchDueReminders: new DispatchDueReminders(reminders, visits, fields, clock, notifier),
    reminderAviso: notifier,
    ...wireCatalogUseCases(zones, clients, fields, visits, reminders, ids),
  };
}

async function renderAgenda() {
  const container = await makeContainer();
  render(
    <CampoProvider container={container}>
      <MemoryRouter>
        <AgendaScreen />
      </MemoryRouter>
    </CampoProvider>,
  );
}

describe('AgendaScreen', () => {
  it('muestra Vencidas primero con su fecha relativa y linkea a registrar', async () => {
    await renderAgenda();
    const overdue = await screen.findByRole('heading', { name: /Vencidas/ });
    expect(overdue).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /El Alto/ });
    expect(link).toHaveAttribute('href', '/field/f1/record');
    expect(screen.getByText('hace 5 d')).toBeInTheDocument();
    expect(screen.getByText('en 2 d')).toBeInTheDocument();
  });

  it('colapsa "Más adelante" y lo expande al tocarlo', async () => {
    await renderAgenda();
    await screen.findByRole('heading', { name: /Vencidas/ });
    expect(screen.queryByRole('link', { name: /Potrero 4/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Ver 1 lote/ }));
    expect(screen.getByRole('link', { name: /Potrero 4/ })).toBeInTheDocument();
  });

  it('reagrupa por zona con el toggle', async () => {
    await renderAgenda();
    await screen.findByRole('heading', { name: /Vencidas/ });
    await userEvent.click(screen.getByLabelText('Zona'));
    expect(await screen.findByRole('heading', { name: /El Séptimo/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /La Costa/ })).toBeInTheDocument();
    // en modo zona no hay colapso: Potrero 4 (La Costa) es visible
    expect(screen.getByRole('link', { name: /Potrero 4/ })).toBeInTheDocument();
  });

  it('muestra estado vacío cuando no hay visitas agendadas', async () => {
    const zoneMap = new Map([['z1', new Zone('z1', 'El Séptimo')]]);
    const clientMap = new Map([['c1', new Client('c1', 'La Querencia')]]);
    const fields = new InMemoryFieldRepository(zoneMap, clientMap, [
      new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
    ]);
    const visits = new InMemoryVisitRepository();
    const clock = new FixedClock(at('2026-07-28'));
    const reminders = new InMemoryReminderRepository();
    const notifier = new InAppReminderNotifier();
    const ids = new IncrementingIdGenerator();
    const zones = new InMemoryZoneRepository(zoneMap);
    const clients = new InMemoryClientRepository(clientMap);
    const container: Container = {
      searchFields: new SearchFields(fields),
      recordVisit: new RecordVisit(fields, visits, reminders, clock, ids),
      listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
      dispatchDueReminders: new DispatchDueReminders(reminders, visits, fields, clock, notifier),
      reminderAviso: notifier,
      ...wireCatalogUseCases(zones, clients, fields, visits, reminders, ids),
    };
    render(
      <CampoProvider container={container}>
        <MemoryRouter><AgendaScreen /></MemoryRouter>
      </CampoProvider>,
    );
    expect(await screen.findByText('No hay visitas agendadas.')).toBeInTheDocument();
  });

  it('muestra un error en vez del estado vacío cuando falla la carga', async () => {
    // Container mínimo: la pantalla solo usa listUpcomingVisits; los otros miembros
    // no se ejercitan en este flujo, así que un stub tipado basta.
    const container = {
      listUpcomingVisits: { execute: () => Promise.reject(new Error('boom')) },
      reminderAviso: { snapshot: () => [] },
    } as unknown as Container;
    render(
      <CampoProvider container={container}>
        <MemoryRouter><AgendaScreen /></MemoryRouter>
      </CampoProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las visitas. Reintentá.');
    expect(screen.queryByText('No hay visitas agendadas.')).not.toBeInTheDocument();
  });
});
