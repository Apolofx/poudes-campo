import type { IdGenerator } from '@/domain/ports/outbound/id-generator';

export class IncrementingIdGenerator implements IdGenerator {
  private n = 0;

  constructor(private readonly prefix = 'id') {}

  next(): string {
    this.n += 1;
    return `${this.prefix}-${this.n}`;
  }
}
