import { useMemo } from 'react';
import type { Client } from '@/domain/entities/client';
import type { CatalogSection } from './catalog-section';
import { useCampo } from '@/ui/CampoProvider';

export function useClientSection(): CatalogSection<Client> {
  const { listClients, createClient, editClient, archiveClient, restoreClient, listCatalogFields } = useCampo();
  return useMemo<CatalogSection<Client>>(() => ({
    basePath: '/catalogo/clientes',
    newPath: '/catalogo/clientes/nuevo',
    labels: {
      listTitle: 'Clientes',
      newAction: 'Nuevo cliente',
      formTitleNew: 'Nuevo cliente',
      formTitleEdit: 'Editar cliente',
      backToList: 'Clientes',
      emptyMessage: 'No hay clientes.',
      cascadeTitle: (name) => `Archivar ${name}`,
      cascadeMessage: (count) => `Este cliente tiene ${count} lotes activos. ¿Archivar también los lotes?`,
    },
    actions: {
      list: () => listClients.execute(),
      create: (name) => createClient.execute(name),
      rename: (id, name) => editClient.execute(id, name),
      archive: (id, cascade) => archiveClient.execute(id, cascade),
      restore: (id) => restoreClient.execute(id),
      countActiveFields: async (id) =>
        (await listCatalogFields.execute()).filter((r) => !r.field.archived && r.field.clientId === id).length,
    },
  }), [listClients, createClient, editClient, archiveClient, restoreClient, listCatalogFields]);
}
