export const clientLabel = (name?: string): string => name ?? 'Sin cliente';
export const zoneLabel = (name?: string): string => name ?? 'Sin zona';

import type { VisitStatus } from '@/domain/entities/visit';

export const visitStatusLabel = (status: VisitStatus): string =>
  status === 'PENDING' ? 'Programada' : status === 'DONE' ? 'Realizada' : 'Cancelada';
