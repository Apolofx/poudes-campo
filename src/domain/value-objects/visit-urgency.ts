import { daysBetween } from '@/domain/shared/date-utils';

export type UrgencyBucket = 'OVERDUE' | 'THIS_WEEK' | 'LATER';

export const THIS_WEEK_DAYS = 7;

export class VisitUrgency {
  private constructor(
    readonly daysUntil: number,
    readonly bucket: UrgencyBucket,
  ) {}

  static of(nextVisitDate: Date, now: Date): VisitUrgency {
    const daysUntil = daysBetween(now, nextVisitDate);
    const bucket: UrgencyBucket =
      daysUntil < 0 ? 'OVERDUE' : daysUntil <= THIS_WEEK_DAYS ? 'THIS_WEEK' : 'LATER';
    return new VisitUrgency(daysUntil, bucket);
  }
}
