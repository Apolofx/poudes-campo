import { useCallback, useState } from 'react';
import { useCampo } from '@/ui/CampoProvider';
import { parseExportFile, summarizeImport } from '@/infrastructure/persistence/idb/data-import';
import type { CampoExport, ImportResult, ImportSummary } from '@/infrastructure/persistence/idb/export-types';

export function useImportData() {
  const { importData } = useCampo();
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, setPending] = useState<CampoExport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(undefined);
    setResult(null);
    try {
      const data = parseExportFile(await file.text());
      setPending(data);
      setSummary(summarizeImport(data));
    } catch (e) {
      setPending(null);
      setSummary(null);
      setError(e as Error);
    }
  }, []);

  const confirmImport = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    setError(undefined);
    try {
      setResult(await importData(pending));
      setPending(null);
      setSummary(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }, [pending, importData]);

  const reset = useCallback(() => {
    setSummary(null);
    setPending(null);
    setError(undefined);
    setResult(null);
  }, []);

  return { handleFile, summary, pending, confirmImport, busy, error, result, reset };
}