import { describe, it, expect } from 'vitest';
import { InvalidExportFormat, UnsupportedExportVersion } from '@/infrastructure/persistence/idb/export-errors';

describe('export-errors', () => {
  it('InvalidExportFormat es un Error con nombre y mensaje', () => {
    const err = new InvalidExportFormat();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('InvalidExportFormat');
    expect(err.message).toContain('invalid');
  });

  it('UnsupportedExportVersion conserva la versión encontrada', () => {
    const err = new UnsupportedExportVersion(2);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('UnsupportedExportVersion');
    expect(err.version).toBe(2);
  });
});