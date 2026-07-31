import { useCallback, useEffect, useState } from 'react';
import type { FieldHistoryView } from '@/application/use-cases/get-field-history';
import { useCampo } from '@/ui/CampoProvider';

export function useFieldHistory(fieldId: string) {
  const { getFieldHistory } = useCampo();
  const [view, setView] = useState<FieldHistoryView | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    getFieldHistory.execute(fieldId).then((v) => {
      setView(v);
      setLoading(false);
    });
  }, [getFieldHistory, fieldId]);

  useEffect(() => { reload(); }, [reload]);

  return { view, loading, reload };
}
