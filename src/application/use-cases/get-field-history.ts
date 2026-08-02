import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { FieldId } from '@/domain/shared/ids';
import type { Field } from '@/domain/entities/field';
import type { Visit } from '@/domain/entities/visit';

export interface FieldHistoryView {
  field: Field;
  clientName?: string;
  zoneName?: string;
  visits: Visit[];
}

export class GetFieldHistory {
  constructor(
    private readonly fields: FieldRepository,
    private readonly visits: VisitRepository,
  ) {}

  async execute(fieldId: FieldId): Promise<FieldHistoryView | null> {
    const rows = await this.fields.listAllWithHierarchy();
    const row = rows.find((r) => r.field.id === fieldId);

    let field = row?.field ?? null;
    if (!field) field = await this.fields.findById(fieldId);
    if (!field) return null;

    const effectiveDate = (v: Visit) => (v.visitedAt ?? v.plannedFor ?? v.createdAt).getTime();
    const visits = [...(await this.visits.listByField(fieldId))].sort((a, b) => {
      const byDate = effectiveDate(b) - effectiveDate(a);
      return byDate !== 0 ? byDate : b.createdAt.getTime() - a.createdAt.getTime();
    });

    return { field, clientName: row?.clientName, zoneName: row?.zoneName, visits };
  }
}
