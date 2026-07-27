import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import { fieldMatchesQuery, type FieldSearchResult } from '@/domain/services/field-search';

export class SearchFields {
  constructor(private readonly fields: FieldRepository) {}

  async execute(query: string): Promise<FieldSearchResult[]> {
    const all = await this.fields.listAllWithHierarchy();
    return all.filter((result) => fieldMatchesQuery(result, query));
  }
}
