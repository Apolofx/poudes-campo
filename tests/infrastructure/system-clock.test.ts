import { describe, it, expect } from 'vitest';
import { SystemClock } from '@/infrastructure/clock/system-clock';

describe('SystemClock', () => {
  it('returns a Date at roughly now', () => {
    const before = Date.now();
    const now = new SystemClock().now();
    const after = Date.now();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });
});
