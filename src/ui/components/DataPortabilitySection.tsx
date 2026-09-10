import { useRef } from 'react';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useExportData } from '@/ui/hooks/use-export-data';
import { useImportData } from '@/ui/hooks/use-import-data';
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
          Exportar datos
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          Importar datos
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
    </section>
  );
}