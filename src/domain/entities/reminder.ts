import type { ReminderId, VisitId, FieldId, ScheduledVisitId } from '@/domain/shared/ids';

export type ReminderStatus = 'PENDING' | 'SENT' | 'CANCELLED';

export interface ReminderProps {
  id: ReminderId;
  visitId: VisitId;
  fieldId: FieldId;
  remindAt: Date;
  status?: ReminderStatus;
  scheduledVisitId?: ScheduledVisitId;
}

export class Reminder {
  readonly id: ReminderId;
  readonly visitId: VisitId;
  readonly fieldId: FieldId;
  readonly remindAt: Date;
  readonly scheduledVisitId?: ScheduledVisitId;
  private _status: ReminderStatus;

  constructor(props: ReminderProps) {
    this.id = props.id;
    this.visitId = props.visitId;
    this.fieldId = props.fieldId;
    this.remindAt = props.remindAt;
    this.scheduledVisitId = props.scheduledVisitId;
    this._status = props.status ?? 'PENDING';
  }

  get status(): ReminderStatus {
    return this._status;
  }

  cancel(): void {
    if (this._status === 'CANCELLED') return;
    this._status = 'CANCELLED';
  }

  markSent(): void {
    if (this._status !== 'PENDING') return;
    this._status = 'SENT';
  }
}
