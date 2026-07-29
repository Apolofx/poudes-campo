import { useCallback, useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';

export function useClearAllData() {
  const { clearAllData } = useCampo();
  const [busy, setBusy] = useState(false);
  const clear = useCallback(async () => {
    setBusy(true);
    try {
      await clearAllData.execute();
    } finally {
      setBusy(false);
    }
  }, [clearAllData]);
  return { clear, busy };
}
