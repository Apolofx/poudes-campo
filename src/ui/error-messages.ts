export function domainErrorMessage(error: Error): string {
  switch (error.name) {
    case 'FutureVisitDate':
      return 'La fecha de la visita no puede ser futura.';
    case 'DuplicateVisitForDay':
      return 'Ya registraste una visita para este lote ese día.';
    case 'FieldNotFound':
      return 'No se encontró el lote.';
    case 'InvalidVisitInterval':
      return 'La próxima visita debe ser posterior a la fecha de la visita.';
    case 'VisitNotFound':
      return 'No se encontró la visita.';
    case 'VisitAlreadyCancelled':
      return 'La visita ya fue cancelada.';
    default:
      return 'Ocurrió un error al registrar la visita.';
  }
}

export function catalogErrorMessage(error: Error): string {
  switch (error.name) {
    case 'EmptyName':
      return 'El nombre no puede estar vacío.';
    case 'ZoneNotFound':
      return 'No se encontró la zona.';
    case 'ClientNotFound':
      return 'No se encontró el cliente.';
    case 'FieldNotFound':
      return 'No se encontró el lote.';
    default:
      return 'Ocurrió un error al guardar.';
  }
}
