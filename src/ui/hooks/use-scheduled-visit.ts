import { useEffect, useState } from 'react';
import type { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { useCampo } from '@/ui/CampoProvider';

export function useScheduledVisit(scheduledVisitId: string): ScheduledVisit | null | undefined {
  const { getScheduledVisit } = useCampo();
  const [scheduledVisit, setScheduledVisit] = useState<ScheduledVisit | null | undefined>(undefined);

  useEffect(() => {
    getScheduledVisit.execute(scheduledVisitId).then(setScheduledVisit);
  }, [getScheduledVisit, scheduledVisitId]);

  return scheduledVisit;
}
