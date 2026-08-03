import { addDays, daysBetweenIso, isoDay } from '@/domain/shared/date-utils';
import { InvalidVisit } from '@/domain/shared/errors';

export type NextVisitInput =
  | { kind: 'interval'; days: number; reminderLeadDays?: number }
  | { kind: 'date'; date: Date; reminderLeadDays?: number }
  | { kind: 'none' };

export interface ResolvedNextPending {
  plannedFor: Date;
  reminderLeadDays: number;
}

export function clampLeadDays(requested: number, daysToDate: number): number {
  return Math.min(Math.max(requested, 0), daysToDate);
}

export function resolveNextPending(input: NextVisitInput, now: Date, today: string): ResolvedNextPending | undefined {
  if (input.kind === 'none') return undefined;
  if (input.kind === 'interval') {
    if (!(input.days >= 1)) throw new InvalidVisit('interval days must be positive');
    const plannedFor = addDays(now, input.days);
    return { plannedFor, reminderLeadDays: clampLeadDays(input.reminderLeadDays ?? 0, input.days) };
  }
  if (isoDay(input.date) <= today) {
    throw new InvalidVisit('next visit date must be in the future');
  }
  return {
    plannedFor: input.date,
    reminderLeadDays: clampLeadDays(input.reminderLeadDays ?? 0, daysBetweenIso(today, isoDay(input.date))),
  };
}
