import { useState, useEffect, useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { useCampo } from '@/ui/CampoProvider';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useExportData } from '@/ui/hooks/use-export-data';
import { useImportData } from '@/ui/hooks/use-import-data';
import { useClearAllData } from '@/ui/hooks/use-clear-all-data';
import { InvalidExportFormat, UnsupportedExportVersion } from '@/infrastructure/persistence/idb/export-errors';
import type { ImportSummary } from '@/infrastructure/persistence/idb/export-types';

function plural(label: string, count: number): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function summaryText(s: ImportSummary): string {
  return [
    plural('zona', s.zones),
    plural('cliente', s.clients),
    plural('lote', s.fields),
    plural('visita', s.visits),
    plural('aviso', s.reminders),
    plural('adjunto', s.media),
  ].filter((part) => !part.startsWith('0 ')).join(', ');
}

export function DataPortabilitySection() {
  const exportData = useExportData();
  const importData = useImportData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = exportData.busy || importData.busy;
  const { listCatalogFields } = useCampo();
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCatalogFields.execute().then((rows) => {
      if (!cancelled) setHasData(rows.length > 0);
    });
    return () => { cancelled = true; };
  }, [listCatalogFields]);

  const [confirming, setConfirming] = useState(false);
  const { clear } = useClearAllData();

  if (!hasData) return null;

  const importError = importData.error
    ? importData.error instanceof InvalidExportFormat
      ? 'El archivo no es un respaldo válido.'
      : importData.error instanceof UnsupportedExportVersion
        ? 'Este archivo viene de una versión más nueva de Campo. Actualizá la app y volvé a intentar.'
        : 'No se pudo importar el archivo.'
    : undefined;

  const importMessage =
    importData.result === null || importData.result === undefined
      ? undefined
      : importData.result.skipped > 0
        ? `Se importaron los datos. ${importData.result.skipped} registros se omitieron por referencias incompletas.`
        : 'Se importaron los datos correctamente.';

  const confirmMessage = importData.summary
    ? `Se importarán ${summaryText(importData.summary)}. Se fusionarán con los datos actuales: los registros con el mismo ID se actualizarán. ¿Continuar?`
    : '';

  return (
    <section className="data-portability" aria-label="Respaldo de datos">
      <span className="field-label">Respaldo de datos</span>
      <div className="data-portability-actions">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void exportData.exportNow()}>
          <Download size={16} aria-hidden="true" /> Exportar datos
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} aria-hidden="true" /> Importar datos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="data-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importData.handleFile(file);
          }}
        />
      </div>
      {exportData.error && <p className="alert" role="alert">No se pudo exportar los datos.</p>}
      {importError && <p className="alert" role="alert">{importError}</p>}
      {importMessage && <p className="success" role="status">{importMessage}</p>}
      <ConfirmDialog
        open={importData.summary !== null}
        title="Importar datos"
        message={confirmMessage}
        confirmLabel="Importar"
        onConfirm={() => void importData.confirmImport()}
        onCancel={importData.reset}
      />

      <section className="danger-zone">
        <h2 className="danger-zone-title">Zona de peligro</h2>
        <div className="danger-zone-row">
          <p>Borrar zonas, clientes, lotes, visitas y avisos de este dispositivo.</p>
          <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>
            Borrar todos los datos
          </button>
        </div>
      </section>
      <ConfirmDialog
        open={confirming}
        title="Borrar todos los datos"
        message="Se eliminarán zonas, clientes, lotes, visitas y avisos de este dispositivo. No se puede deshacer."
        confirmLabel="Borrar"
        onConfirm={async () => { setConfirming(false); await clear(); }}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}