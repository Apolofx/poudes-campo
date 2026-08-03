import { useMemo } from 'react';
import type { Zone } from '@/domain/entities/zone';
import type { CatalogSection } from './catalog-section';
import { useCampo } from '@/ui/CampoProvider';

export function useZoneSection(): CatalogSection<Zone> {
  const { listZones, createZone, editZone, archiveZone, restoreZone, listCatalogFields } = useCampo();
  return useMemo<CatalogSection<Zone>>(() => ({
    basePath: '/catalogo/zonas',
    newPath: '/catalogo/zonas/nueva',
    labels: {
      listTitle: 'Zonas',
      newAction: 'Nueva zona',
      formTitleNew: 'Nueva zona',
      formTitleEdit: 'Editar zona',
      backToList: 'Zonas',
      emptyMessage: 'No hay zonas.',
      cascadeTitle: (name) => `Archivar ${name}`,
      cascadeMessage: (count) => `Esta zona tiene ${count} lotes activos. ¿Archivar también los lotes?`,
    },
    actions: {
      list: () => listZones.execute(),
      create: (name) => createZone.execute(name),
      rename: (id, name) => editZone.execute(id, name),
      archive: (id, cascade) => archiveZone.execute(id, cascade),
      restore: (id) => restoreZone.execute(id),
      countActiveFields: async (id) =>
        (await listCatalogFields.execute()).filter((r) => !r.field.archived && r.field.zoneId === id).length,
    },
  }), [listZones, createZone, editZone, archiveZone, restoreZone, listCatalogFields]);
}
