import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { CampoProvider } from '@/ui/CampoProvider';
import { useRecordVisit } from '@/ui/hooks/use-record-visit';
import { makeInMemoryContainer } from '../support/in-memory-container';

const NOW = new Date('2026-07-27T12:00:00Z');

function wrapper({ children }: { children: ReactNode }) {
  return <CampoProvider container={makeInMemoryContainer(NOW)}>{children}</CampoProvider>;
}

describe('useRecordVisit', () => {
  it('records a visit and exposes the result', async () => {
    const { result } = renderHook(() => useRecordVisit(), { wrapper });
    await act(async () => {
      result.current.submit({
        fieldId: 'f1',
        visitDate: new Date('2026-07-27T09:00:00Z'),
        followUp: { kind: 'none' },
      });
    });
    await waitFor(() => expect(result.current.result?.visitId).toBeTruthy());
    expect(result.current.error).toBeUndefined();
  });

  it('exposes a domain error for a future visit date', async () => {
    const { result } = renderHook(() => useRecordVisit(), { wrapper });
    await act(async () => {
      result.current.submit({
        fieldId: 'f1',
        visitDate: new Date('2026-08-01T09:00:00Z'),
        followUp: { kind: 'none' },
      });
    });
    await waitFor(() => expect(result.current.error?.name).toBe('FutureVisitDate'));
  });
});
