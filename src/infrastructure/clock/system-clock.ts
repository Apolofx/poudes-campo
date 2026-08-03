import type { Clock } from '@/domain/ports/outbound/clock';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  today(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
