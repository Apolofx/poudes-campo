import { describe, it, expect } from 'vitest';
import { domainErrorMessage } from '@/ui/error-messages';
import { ScheduledDateNotFuture, ScheduledVisitNotFound, ScheduledVisitAlreadyCancelled } from '@/domain/shared/errors';

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

  it('maps InvalidVisitInterval', () => {
    expect(domainErrorMessage(errorNamed('InvalidVisitInterval'))).toBe(
      'La próxima visita debe ser posterior a la fecha de la visita.',
    );
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(domainErrorMessage(errorNamed('SomethingElse'))).toBe(
      'Ocurrió un error con la visita.',
    );
  });

  it('maps the new scheduled-visit errors', () => {
    expect(domainErrorMessage(new ScheduledDateNotFuture(''))).toContain('futura');
    expect(domainErrorMessage(new ScheduledVisitNotFound(''))).toContain('programada');
    expect(domainErrorMessage(new ScheduledVisitAlreadyCancelled(''))).toContain('cancelada');
  });
});
