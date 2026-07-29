import type { Zone } from '@/domain/entities/zone';
import type { ZoneId } from '@/domain/shared/ids';

export interface ZoneRepository {
  save(zone: Zone): Promise<void>;
  findById(id: ZoneId): Promise<Zone | null>;
  listAll(): Promise<Zone[]>; // incluye archivados; la UI filtra
}
