import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { Visit } from '@/domain/entities/visit';
import type { VisitId } from '@/domain/shared/ids';

export class GetVisit {
  constructor(private readonly visits: VisitRepository) {}

  execute(visitId: VisitId): Promise<Visit | null> {
    return this.visits.findById(visitId);
  }
}
