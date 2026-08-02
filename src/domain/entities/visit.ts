import type { VisitId, FieldId } from '@/domain/shared/ids';
import { InvalidVisit } from '@/domain/shared/errors';

export type VisitStatus = 'PENDING' | 'DONE' | 'CANCELLED';

export interface VisitProps {
  id: VisitId;
  fieldId: FieldId;
  status: VisitStatus;
  plannedFor?: Date;
  visitedAt?: Date;
  reminderLeadDays?: number;
  notes?: string;
  createdAt: Date;
  cancelledAt?: Date;
}

export class Visit {
  readonly id: VisitId;
  readonly fieldId: FieldId;
  readonly status: VisitStatus;
  readonly plannedFor?: Date;
  readonly visitedAt?: Date;
  readonly reminderLeadDays?: number;
  readonly notes?: string;
  readonly createdAt: Date;
  readonly cancelledAt?: Date;

  constructor(props: VisitProps) {
    if (props.status === 'PENDING' && !props.plannedFor) {
      throw new InvalidVisit('PENDING visit requires plannedFor');
    }
    if (props.status === 'PENDING' && (props.reminderLeadDays ?? 0) < 0) {
      throw new InvalidVisit('PENDING visit requires a non-negative reminderLeadDays');
    }
    if (props.status === 'PENDING' && props.visitedAt) {
      throw new InvalidVisit('PENDING visit cannot have visitedAt');
    }
    if (props.status === 'DONE' && !props.visitedAt) {
      throw new InvalidVisit('DONE visit requires visitedAt');
    }
    if (props.status === 'CANCELLED' && !props.cancelledAt) {
      throw new InvalidVisit('CANCELLED visit requires cancelledAt');
    }

    this.id = props.id;
    this.fieldId = props.fieldId;
    this.status = props.status;
    this.plannedFor = props.plannedFor;
    this.visitedAt = props.visitedAt;
    this.reminderLeadDays = props.reminderLeadDays;
    this.notes = props.notes;
    this.createdAt = props.createdAt;
    this.cancelledAt = props.cancelledAt;
  }
}
