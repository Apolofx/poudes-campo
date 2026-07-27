export function domainErrorMessage(error: Error): string {
  switch (error.name) {
    case 'FutureVisitDate':
      return 'La fecha de la visita no puede ser futura.';
    case 'DuplicateVisitForDay':
      return 'Ya registraste una visita para este lote ese día.';
    case 'FieldNotFound':
      return 'No se encontró el lote.';
    default:
      return 'Ocurrió un error al registrar la visita.';
  }
}
