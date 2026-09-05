import { useState, useEffect, useCallback } from 'react';

export function useSWUpdate() {
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    const onControllerChange = () => setUpdated(true);
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
  }, []);

  const dismiss = useCallback(() => setUpdated(false), []);

  return { updated, dismiss };
}
