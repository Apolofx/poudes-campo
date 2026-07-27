import { InvalidHectares } from '@/domain/shared/errors';

export class Hectares {
  private constructor(readonly value: number) {}

  static of(value: number): Hectares {
    if (!Number.isFinite(value) || value <= 0) {
      throw new InvalidHectares(`hectares must be > 0, got ${value}`);
    }
    return new Hectares(value);
  }
}
