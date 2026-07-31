import type { ScheduledVisitId, FieldId } from '@/domain/shared/ids';
import { InvalidScheduledVisit } from '@/domain/shared/errors';

export type ScheduledVisitStatus = 'ACTIVE' | 'CANCELLED';

export interface ScheduledVisitProps {
  id: ScheduledVisitId;
  fieldId: FieldId;
  scheduledDate: Date;
  reminderLeadDays: number;
  createdAt: Date;
  notes?: string;
  status?: ScheduledVisitStatus;
  cancelledAt?: Date;
}

export class ScheduledVisit {
  readonly id: ScheduledVisitId;
  readonly fieldId: FieldId;
  readonly scheduledDate: Date;
  readonly reminderLeadDays: number;
  readonly createdAt: Date;
  readonly notes?: string;
  readonly status: ScheduledVisitStatus;
  readonly cancelledAt?: Date;

  constructor(props: ScheduledVisitProps) {
    if (!props.scheduledDate || props.reminderLeadDays < 0) {
      throw new InvalidScheduledVisit('scheduled visit requires a future date and a non-negative lead');
    }
    this.id = props.id;
    this.fieldId = props.fieldId;
    this.scheduledDate = props.scheduledDate;
    this.reminderLeadDays = props.reminderLeadDays;
    this.createdAt = props.createdAt;
    this.notes = props.notes;
    this.status = props.status ?? 'ACTIVE';
    this.cancelledAt = props.cancelledAt;
  }
}
