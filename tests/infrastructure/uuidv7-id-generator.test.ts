import { describe, it, expect } from 'vitest';
import { Uuidv7IdGenerator } from '@/infrastructure/id/uuidv7-id-generator';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Uuidv7IdGenerator', () => {
  it('generates version-7 UUIDs', () => {
    expect(new Uuidv7IdGenerator().next()).toMatch(UUID_V7);
  });

  it('generates distinct ids', () => {
    const gen = new Uuidv7IdGenerator();
    expect(gen.next()).not.toBe(gen.next());
  });
});
