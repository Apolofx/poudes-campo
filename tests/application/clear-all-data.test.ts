import { describe, it, expect } from 'vitest';
import { ClearAllData } from '@/application/use-cases/clear-all-data';
import { InMemoryDataReset } from '@/infrastructure/persistence/in-memory/in-memory-data-reset';

describe('ClearAllData', () => {
  it('invokes every registered clear callback', async () => {
    const calls: string[] = [];
    const reset = new InMemoryDataReset([
      () => calls.push('zones'),
      () => calls.push('fields'),
    ]);
    await new ClearAllData(reset).execute();
    expect(calls).toEqual(['zones', 'fields']);
  });
});
