import { InvalidVisitInterval } from '@/domain/shared/errors';

export class VisitInterval {
  private constructor(readonly days: number) {}

  static ofDays(days: number): VisitInterval {
    if (!Number.isInteger(days) || days <= 0) {
      throw new InvalidVisitInterval(`interval days must be a positive integer, got ${days}`);
    }
    return new VisitInterval(days);
  }
}
