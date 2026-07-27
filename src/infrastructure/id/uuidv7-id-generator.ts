import { uuidv7 } from 'uuidv7';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';

export class Uuidv7IdGenerator implements IdGenerator {
  next(): string {
    return uuidv7();
  }
}
