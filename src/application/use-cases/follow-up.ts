import type { FollowUp } from '@/domain/entities/visit';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { addDays, daysBetween } from '@/domain/shared/date-utils';

export type FollowUpInput =
  | { kind: 'interval'; days: number; reminderLeadDays?: number }
  | { kind: 'date'; date: Date; reminderLeadDays?: number }
  | { kind: 'none' };

export function resolveFollowUp(input: FollowUpInput, now: Date): FollowUp | undefined {
  if (input.kind === 'interval') {
    return { nextVisitDate: addDays(now, input.days), interval: VisitInterval.ofDays(input.days) };
  }
  if (input.kind === 'date') {
    return { nextVisitDate: input.date, interval: VisitInterval.ofDays(daysBetween(now, input.date)) };
  }
  return undefined;
}

export function clampLeadDays(requested: number, intervalDays: number): number {
  return Math.min(Math.max(requested, 0), intervalDays);
}

export function remindAtFor(followUp: FollowUp, requestedLeadDays: number): Date {
  return addDays(followUp.nextVisitDate, -clampLeadDays(requestedLeadDays, followUp.interval.days));
}
