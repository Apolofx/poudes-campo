import { useCallback, useState } from 'react';
import type {
  ScheduleVisitEnsuringFieldInput,
  ScheduleVisitEnsuringFieldResult,
} from '@/application/use-cases/schedule-visit-ensuring-field';
import { useCampo } from '@/ui/CampoProvider';

export function useScheduleVisitEnsuringField() {
  const { scheduleVisitEnsuringField, syncPendingVisitsFeed } = useCampo();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const submit = useCallback(
    async (input: ScheduleVisitEnsuringFieldInput): Promise<ScheduleVisitEnsuringFieldResult | undefined> => {
      setSubmitting(true);
      setError(undefined);
      try {
        const result = await scheduleVisitEnsuringField.execute(input);
        void syncPendingVisitsFeed();
        return result;
      } catch (e) {
        setError(e as Error);
        return undefined;
      } finally {
        setSubmitting(false);
      }
    },
    [scheduleVisitEnsuringField, syncPendingVisitsFeed],
  );

  return { submit, submitting, error };
}
