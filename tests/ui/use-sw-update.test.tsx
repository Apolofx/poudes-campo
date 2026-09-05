import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSWUpdate } from '@/ui/hooks/useSWUpdate';

let listeners: Record<string, Set<EventListener>>;

function fireControllerChange() {
  const event = new Event('controllerchange');
  navigator.serviceWorker.dispatchEvent(event);
}

describe('useSWUpdate', () => {
  beforeEach(() => {
    listeners = {};
    vi.stubGlobal('navigator', {
      serviceWorker: {
        addEventListener: vi.fn((type: string, cb: EventListener) => {
          (listeners[type] ??= new Set()).add(cb);
        }),
        removeEventListener: vi.fn((type: string, cb: EventListener) => {
          listeners[type]?.delete(cb);
        }),
        dispatchEvent: vi.fn((e: Event) => {
        listeners[e.type]?.forEach((cb) => cb(e));
      }),
      },
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('inicia con updated = false', () => {
    const { result } = renderHook(() => useSWUpdate());
    expect(result.current.updated).toBe(false);
  });

  it('updated pasa a true cuando se dispara controllerchange', () => {
    const { result } = renderHook(() => useSWUpdate());
    expect(result.current.updated).toBe(false);

    act(() => { fireControllerChange(); });

    expect(result.current.updated).toBe(true);
  });

  it('dismiss pone updated en false', () => {
    const { result } = renderHook(() => useSWUpdate());

    act(() => { fireControllerChange(); });
    expect(result.current.updated).toBe(true);

    act(() => { result.current.dismiss(); });
    expect(result.current.updated).toBe(false);
  });
});
