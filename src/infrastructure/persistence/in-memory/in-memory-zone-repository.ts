import type { Zone } from '@/domain/entities/zone';
import type { ZoneId } from '@/domain/shared/ids';
import type { ZoneRepository } from '@/domain/ports/outbound/zone-repository';

export class InMemoryZoneRepository implements ZoneRepository {
  constructor(private readonly zones: Map<ZoneId, Zone>) {}

  async save(zone: Zone): Promise<void> {
    this.zones.set(zone.id, zone);
  }

  async findById(id: ZoneId): Promise<Zone | null> {
    return this.zones.get(id) ?? null;
  }

  async listAll(): Promise<Zone[]> {
    return [...this.zones.values()];
  }

  clear(): void {
    this.zones.clear();
  }
}
