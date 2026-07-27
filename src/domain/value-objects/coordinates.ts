import { InvalidCoordinates } from '@/domain/shared/errors';

export class Coordinates {
  private constructor(
    readonly latitude: number,
    readonly longitude: number,
  ) {}

  static of(latitude: number, longitude: number): Coordinates {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new InvalidCoordinates(`latitude out of range: ${latitude}`);
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new InvalidCoordinates(`longitude out of range: ${longitude}`);
    }
    return new Coordinates(latitude, longitude);
  }
}
