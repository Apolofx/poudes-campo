import { describe, it, expect } from 'vitest';
import { domainErrorMessage } from '@/ui/error-messages';
import { PlannedDateNotFuture, InvalidVisit } from '@/domain/shared/errors';

function errorNamed(name: string): Error {
  const error = new Error('boom');
  error.name = name;
  return error;
}

describe('domainErrorMessage', () => {
  it('maps FutureVisitDate', () => {
    expect(domainErrorMessage(errorNamed('FutureVisitDate'))).toBe(
      'La fecha de la visita no puede ser futura.',
    );
  });

  it('maps DuplicateVisitForDay', () => {
    expect(domainErrorMessage(errorNamed('DuplicateVisitForDay'))).toBe(
      'Ya registraste una visita para este lote ese día.',
    );
  });

  it('maps FieldNotFound', () => {
    expect(domainErrorMessage(errorNamed('FieldNotFound'))).toBe('No se encontró el lote.');
  });

  it('maps InvalidVisit', () => {
    expect(domainErrorMessage(errorNamed('InvalidVisit'))).toBe(
      'La visita no admite esa edición.',
    );
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(domainErrorMessage(errorNamed('SomethingElse'))).toBe(
      'Ocurrió un error con la visita.',
    );
  });

  it('maps the new unified-visit errors', () => {
    expect(domainErrorMessage(new PlannedDateNotFuture(''))).toContain('futura');
    expect(domainErrorMessage(new InvalidVisit(''))).toContain('edición');
  });
});
