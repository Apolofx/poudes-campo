import type { VisitId, FieldId } from '@/domain/shared/ids';
import type { VisitInterval } from '@/domain/value-objects/visit-interval';
import { IncompleteFollowUp } from '@/domain/shared/errors';

export type VisitStatus = 'ACTIVE' | 'CANCELLED';

export interface FollowUp {
  nextVisitDate: Date;
  interval: VisitInterval;
}

export interface VisitProps {
  id: VisitId;
  fieldId: FieldId;
  visitDate: Date;
  createdAt: Date;
  notes?: string;
  followUp?: FollowUp;
  status?: VisitStatus;
  cancelledAt?: Date;
}

export class Visit {
  readonly id: VisitId;
  readonly fieldId: FieldId;
  readonly visitDate: Date;
  readonly createdAt: Date;
  readonly notes?: string;
  readonly followUp?: FollowUp;
  readonly status: VisitStatus;
  readonly cancelledAt?: Date;

  constructor(props: VisitProps) {
    if (props.followUp && (!props.followUp.nextVisitDate || !props.followUp.interval)) {
      throw new IncompleteFollowUp('follow-up requires both nextVisitDate and interval');
    }

    this.id = props.id;
    this.fieldId = props.fieldId;
    this.visitDate = props.visitDate;
    this.createdAt = props.createdAt;
    this.notes = props.notes;
    this.followUp = props.followUp;
    this.status = props.status ?? 'ACTIVE';
    this.cancelledAt = props.cancelledAt;
  }
}
