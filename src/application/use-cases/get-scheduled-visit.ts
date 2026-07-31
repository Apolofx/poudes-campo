import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import type { ScheduledVisitId } from '@/domain/shared/ids';

export class GetScheduledVisit {
  constructor(private readonly scheduled: ScheduledVisitRepository) {}

  execute(id: ScheduledVisitId): Promise<ScheduledVisit | null> {
    return this.scheduled.findById(id);
  }
}
