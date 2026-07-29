import type { ZoneRepository } from '@/domain/ports/outbound/zone-repository';
import type { Zone } from '@/domain/entities/zone';
import type { ZoneId } from '@/domain/shared/ids';
import type { CampoDb } from './open-campo-db';
import { toZoneRecord, fromZoneRecord } from './records';

export class IdbZoneRepository implements ZoneRepository {
  constructor(private readonly db: CampoDb) {}

  async save(zone: Zone): Promise<void> {
    await this.db.put('zones', toZoneRecord(zone));
  }

  async findById(id: ZoneId): Promise<Zone | null> {
    const record = await this.db.get('zones', id);
    return record ? fromZoneRecord(record) : null;
  }

  async listAll(): Promise<Zone[]> {
    return (await this.db.getAll('zones')).map(fromZoneRecord);
  }
}
