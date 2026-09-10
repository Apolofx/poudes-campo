import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampoProvider } from '@/ui/CampoProvider';
import { DataPortabilitySection } from '@/ui/components/DataPortabilitySection';
import { triggerDownload } from '@/ui/export-download';
import { makeInMemoryContainer } from '../support/in-memory-container';
import type { CampoExport } from '@/infrastructure/persistence/idb/export-types';

vi.mock('@/ui/export-download', () => ({ triggerDownload: vi.fn() }));

const FIXTURE: CampoExport = {
  version: 1,
  exportedAt: '2026-09-10T12:00:00.000Z',
  zones: [{ id: 'z1', name: 'Norte' }],
  clients: [],
  fields: [{ id: 'f1', name: 'Lote 1' }],
  visits: [{ id: 'v1', fieldId: 'f1', status: 'DONE', visitedAt: '2026-09-01T12:00:00.000Z', createdAt: '2026-09-01T11:00:00.000Z' }],
  reminders: [],
  media: [],
};

function renderSection(container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <DataPortabilitySection />
    </CampoProvider>,
  );
  return container;
}

describe('DataPortabilitySection', () => {
  it('muestra los botones de exportar e importar', async () => {
    renderSection();
    expect(await screen.findByRole('button', { name: 'Exportar datos' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Importar datos' })).toBeInTheDocument();
  });

  it('no se muestra cuando no hay datos', () => {
    const container = makeInMemoryContainer();
    vi.spyOn(container.listCatalogFields, 'execute').mockResolvedValue([]);
    renderSection(container);
    expect(screen.queryByRole('button', { name: 'Exportar datos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Importar datos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Borrar todos los datos' })).not.toBeInTheDocument();
  });

  it('muestra la zona de peligro con el botón de borrar', async () => {
    renderSection();
    expect(await screen.findByRole('button', { name: 'Borrar todos los datos' })).toBeInTheDocument();
  });

  it('borra todos los datos al confirmar', async () => {
    const container = renderSection();
    vi.spyOn(container.clearAllData, 'execute').mockResolvedValue(undefined);

    await userEvent.click(await screen.findByRole('button', { name: 'Borrar todos los datos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));

    expect(container.clearAllData.execute).toHaveBeenCalled();
  });

  it('exportar descarga el backup con el filename del día', async () => {
    const container = renderSection();
    vi.spyOn(container, 'exportData').mockResolvedValue(FIXTURE);

    await screen.findByRole('button', { name: 'Exportar datos' });
    await userEvent.click(screen.getByRole('button', { name: 'Exportar datos' }));

    const today = new Date().toISOString().slice(0, 10);
    expect(container.exportData).toHaveBeenCalledTimes(1);
    expect(triggerDownload).toHaveBeenCalledWith(FIXTURE, `campo-backup-${today}.json`);
  });

  it('importar muestra el resumen, confirma y avisa el éxito', async () => {
    const container = renderSection();
    const importSpy = vi.spyOn(container, 'importData').mockResolvedValue({ skipped: 0 });

    await screen.findByRole('button', { name: 'Importar datos' });
    const file = new File([JSON.stringify(FIXTURE)], 'backup.json', { type: 'application/json' });
    fireEvent.change(document.querySelector('.data-file-input') as HTMLInputElement, { target: { files: [file] } });

    expect(await screen.findByText(/Se importarán 1 zona, 1 lote, 1 visita/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));

    await screen.findByRole('status');
    expect(importSpy).toHaveBeenCalledWith(FIXTURE);
    expect(screen.getByRole('status')).toHaveTextContent('Se importaron los datos correctamente');
  });

  it('importar un archivo inválido muestra error de formato', async () => {
    renderSection();
    await screen.findByRole('button', { name: 'Importar datos' });

    const file = new File(['{no es json'], 'backup.json', { type: 'application/json' });
    fireEvent.change(document.querySelector('.data-file-input') as HTMLInputElement, { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo no es un respaldo válido.');
  });

  it('importar una versión más nueva muestra el mensaje de actualizar la app', async () => {
    renderSection();
    await screen.findByRole('button', { name: 'Importar datos' });

    const file = new File([JSON.stringify({ ...FIXTURE, version: 99 })], 'backup.json', { type: 'application/json' });
    fireEvent.change(document.querySelector('.data-file-input') as HTMLInputElement, { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/versión más nueva/);
  });

  it('avisa si hubo registros omitidos por referencias incompletas', async () => {
    const container = renderSection();
    vi.spyOn(container, 'importData').mockResolvedValue({ skipped: 4 });

    await screen.findByRole('button', { name: 'Importar datos' });
    const file = new File([JSON.stringify(FIXTURE)], 'backup.json', { type: 'application/json' });
    fireEvent.change(document.querySelector('.data-file-input') as HTMLInputElement, { target: { files: [file] } });
    await screen.findByText(/Se importarán/);
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));

    expect(await screen.findByRole('status')).toHaveTextContent('4 registros se omitieron');
  });
});