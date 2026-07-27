import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { CampoProvider } from '@/ui/CampoProvider';
import { useSearchFields } from '@/ui/hooks/use-search-fields';
import { makeInMemoryContainer } from '../support/in-memory-container';

function wrapper({ children }: { children: ReactNode }) {
  return <CampoProvider container={makeInMemoryContainer()}>{children}</CampoProvider>;
}

describe('useSearchFields', () => {
  it('lists all fields for an empty query', async () => {
    const { result } = renderHook(() => useSearchFields(), { wrapper });
    await act(async () => { result.current.search(''); });
    await waitFor(() => expect(result.current.results).toHaveLength(2));
  });

  it('filters by query', async () => {
    const { result } = renderHook(() => useSearchFields(), { wrapper });
    await act(async () => { result.current.search('Alto'); });
    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.results[0].field.name).toBe('Lote El Alto');
  });
});
