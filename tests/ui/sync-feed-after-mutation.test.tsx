import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { CampoProvider } from '@/ui/CampoProvider';
import { useScheduleVisitEnsuringField } from '@/ui/hooks/use-schedule-visit-ensuring-field';
import { useCancelVisit } from '@/ui/hooks/use-cancel-visit';
import { makeInMemoryContainer } from '../support/in-memory-container';

const NOW = new Date('2026-07-27T12:00:00Z');

function makeWrapper() {
  const container = makeInMemoryContainer(NOW);
  const syncPendingVisitsFeed = vi.fn().mockResolvedValue(undefined);
  container.syncPendingVisitsFeed = syncPendingVisitsFeed;
  const wrapper = ({ children }: { children: ReactNode }) => <CampoProvider container={container}>{children}</CampoProvider>;
  return { wrapper, syncPendingVisitsFeed };
}

describe('push del feed de programadas tras mutaciones', () => {
  it('programar una visita dispara el push del feed', async () => {
    const { wrapper, syncPendingVisitsFeed } = makeWrapper();
    const { result } = renderHook(() => useScheduleVisitEnsuringField(), { wrapper });

    await act(async () => {
      await result.current.submit({
        plannedFor: new Date('2026-08-10T09:00:00Z'),
        reminderLeadDays: 2,
        field: { id: 'f1' },
      });
    });

    expect(result.current.error).toBeUndefined();
    expect(syncPendingVisitsFeed).toHaveBeenCalledTimes(1);
  });

  it('cancelar una visita dispara el push del feed', async () => {
    const { wrapper, syncPendingVisitsFeed } = makeWrapper();
    const { result: schedule } = renderHook(() => useScheduleVisitEnsuringField(), { wrapper });

    let visitId = '';
    await act(async () => {
      const res = await schedule.current.submit({
        plannedFor: new Date('2026-08-10T09:00:00Z'),
        reminderLeadDays: 2,
        field: { id: 'f1' },
      });
      visitId = res?.visitId ?? '';
    });
    expect(syncPendingVisitsFeed).toHaveBeenCalledTimes(1);

    const { result: cancel } = renderHook(() => useCancelVisit(), { wrapper });
    await act(async () => {
      await cancel.current.cancel(visitId);
    });

    await waitFor(() => expect(cancel.current.done).toBe(true));
    expect(syncPendingVisitsFeed).toHaveBeenCalledTimes(2);
  });
});
