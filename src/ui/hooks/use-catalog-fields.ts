import { useCallback, useEffect, useState } from 'react';
import type { CatalogFieldRow } from '@/domain/ports/outbound/field-repository';
import type { Zone } from '@/domain/entities/zone';
import type { Client } from '@/domain/entities/client';
import type { FieldId } from '@/domain/shared/ids';
import { useCampo } from '@/ui/CampoProvider';

export function useCatalogFields() {
  const { listCatalogFields, archiveField, restoreField, listZones, listClients } = useCampo();
  const [rows, setRows] = useState<CatalogFieldRow[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [r, z, c] = await Promise.all([listCatalogFields.execute(), listZones.execute(), listClients.execute()]);
      setRows(r);
      setZones(z.filter((x) => !x.archived));
      setClients(c.filter((x) => !x.archived));
    } finally {
      setLoading(false);
    }
  }, [listCatalogFields, listZones, listClients]);

  useEffect(() => { void reload(); }, [reload]);

  const archive = useCallback(async (id: FieldId) => { await archiveField.execute(id); await reload(); }, [archiveField, reload]);
  const restore = useCallback(async (id: FieldId) => { await restoreField.execute(id); await reload(); }, [restoreField, reload]);

  return { rows, zones, clients, loading, reload, archive, restore };
}
