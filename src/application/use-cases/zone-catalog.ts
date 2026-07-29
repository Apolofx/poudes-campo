import type { ZoneRepository } from '@/domain/ports/outbound/zone-repository';
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { ZoneId } from '@/domain/shared/ids';
import { Zone } from '@/domain/entities/zone';
import { ZoneNotFound } from '@/domain/shared/errors';

export class CreateZone {
  constructor(private readonly zones: ZoneRepository, private readonly ids: IdGenerator) {}
  async execute(name: string): Promise<Zone> {
    const zone = new Zone(this.ids.next(), name);
    await this.zones.save(zone);
    return zone;
  }
}

export class EditZone {
  constructor(private readonly zones: ZoneRepository) {}
  async execute(id: ZoneId, name: string): Promise<Zone> {
    const existing = await this.zones.findById(id);
    if (!existing) throw new ZoneNotFound(`unknown zone ${id}`);
    const renamed = new Zone(existing.id, name, existing.archived);
    await this.zones.save(renamed);
    return renamed;
  }
}

export class ArchiveZone {
  constructor(private readonly zones: ZoneRepository, private readonly fields: FieldRepository) {}
  async execute(id: ZoneId, cascadeFields: boolean): Promise<void> {
    const zone = await this.zones.findById(id);
    if (!zone) throw new ZoneNotFound(`unknown zone ${id}`);
    await this.zones.save(zone.archive());
    const affected = await this.fields.findActiveByZoneId(id);
    for (const field of affected) {
      await this.fields.save(cascadeFields ? field.archive() : field.reassignZone(undefined));
    }
  }
}

export class RestoreZone {
  constructor(private readonly zones: ZoneRepository) {}
  async execute(id: ZoneId): Promise<void> {
    const zone = await this.zones.findById(id);
    if (!zone) throw new ZoneNotFound(`unknown zone ${id}`);
    await this.zones.save(zone.restore());
  }
}

export class ListZones {
  constructor(private readonly zones: ZoneRepository) {}
  async execute(): Promise<Zone[]> {
    return this.zones.listAll();
  }
}
