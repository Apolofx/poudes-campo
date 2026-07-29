import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampoProvider } from '@/ui/CampoProvider';
import { ReminderAvisoBanner } from '@/ui/components/ReminderAvisoBanner';
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
import type { DueReminder } from '@/domain/ports/outbound/reminder-notifier';
import type { Container } from '@/composition/container';

const due = (fieldName: string, zoneName: string): DueReminder => ({
  reminderId: `r-${fieldName}`, fieldId: `f-${fieldName}`, fieldName,
  clientName: 'Pérez', zoneName,
  nextVisitDate: new Date('2026-08-12T00:00:00Z'), remindAt: new Date('2026-08-09T00:00:00Z'),
});

function renderBanner(batch: DueReminder[]) {
  const notifier = new InAppReminderNotifier();
  notifier.notify(batch);
  const container = { reminderAviso: notifier } as unknown as Container;
  render(
    <CampoProvider container={container}>
      <ReminderAvisoBanner />
    </CampoProvider>,
  );
}

describe('ReminderAvisoBanner', () => {
  it('no renderiza nada cuando no hay avisos', () => {
    renderBanner([]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('lista los lotes agrupados por zona con el conteo', () => {
    renderBanner([due('El Alto', 'Norte'), due('La Loma', 'Norte'), due('Est. Sur', 'Sur')]);
    expect(screen.getByText(/3 lotes para visitar pronto/)).toBeInTheDocument();
    expect(screen.getByText('Norte')).toBeInTheDocument();
    expect(screen.getByText(/El Alto, La Loma/)).toBeInTheDocument();
    expect(screen.getByText('Sur')).toBeInTheDocument();
    expect(screen.getByText('Est. Sur')).toBeInTheDocument();
  });

  it('se oculta al tocar Cerrar', async () => {
    renderBanner([due('El Alto', 'Norte')]);
    expect(screen.getByRole('status')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('groups an orphan reminder (undefined zoneName) under "Sin zona"', () => {
    renderBanner([
      {
        reminderId: 'r1', fieldId: 'f1', fieldName: 'El Alto',
        clientName: undefined, zoneName: undefined,
        nextVisitDate: new Date(), remindAt: new Date(),
      },
    ]);
    expect(screen.getByText('Sin zona')).toBeInTheDocument();
    expect(screen.getByText(/El Alto/)).toBeInTheDocument();
  });
});
