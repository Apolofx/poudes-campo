import { useCallback, useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';
import { triggerDownload } from '@/ui/export-download';

export function useExportData() {
  const { exportData } = useCampo();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const exportNow = useCallback(async () => {
    setBusy(true);
    setError(undefined);
    try {
      const data = await exportData();
      const today = new Date().toISOString().slice(0, 10);
      triggerDownload(data, `campo-backup-${today}.json`);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }, [exportData]);

  return { exportNow, busy, error };
}