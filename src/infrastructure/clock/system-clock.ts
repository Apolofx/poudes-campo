import type { Clock } from '@/domain/ports/outbound/clock';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
