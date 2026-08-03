import type { Clock } from '@/domain/ports/outbound/clock';

export class FixedClock implements Clock {
  constructor(private current: Date, private todayIso?: string) {}

  now(): Date {
    return this.current;
  }

  today(): string {
    return this.todayIso ?? this.current.toISOString().slice(0, 10);
  }

  set(date: Date): void {
    this.current = date;
  }
}
