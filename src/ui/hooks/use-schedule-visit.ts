import { useCallback, useState } from 'react';
import type { ScheduleVisitInput, ScheduleVisitResult } from '@/application/use-cases/schedule-visit';
import { useCampo } from '@/ui/CampoProvider';

export function useScheduleVisit() {
  const { scheduleVisit } = useCampo();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [result, setResult] = useState<ScheduleVisitResult | undefined>();

  const submit = useCallback(
    async (input: ScheduleVisitInput) => {
      setSubmitting(true);
      setError(undefined);
      try {
        setResult(await scheduleVisit.execute(input));
      } catch (e) {
        setError(e as Error);
      } finally {
        setSubmitting(false);
      }
    },
    [scheduleVisit],
  );

  return { submit, submitting, error, result };
}
