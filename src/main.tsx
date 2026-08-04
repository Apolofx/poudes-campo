import '@/ui/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { seedIfEmpty } from '@/composition/seed';
import { buildContainer } from '@/composition/container';
import { CampoProvider } from '@/ui/CampoProvider';
import { TenantConfigProvider } from '@/ui/TenantConfigProvider';
import { App } from '@/ui/App';

async function main() {
  const db = await openCampoDb();
  if (import.meta.env.DEV) {
    await seedIfEmpty(db);
  }
  const container = buildContainer(db);

  try {
    await container.dispatchDueReminders.execute();
  } catch (error) {
    console.error('reminder dispatch failed', error);
  }

  void container.syncPendingVisitsFeed();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CampoProvider container={container}>
        <TenantConfigProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </TenantConfigProvider>
      </CampoProvider>
    </StrictMode>,
  );
}

function renderStartupError(error: unknown): void {
  console.error('Failed to start Campo:', error);
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = '';
  const errorShell = document.createElement('main');
  const heading = document.createElement('h1');
  heading.textContent = 'No se pudo abrir la base de datos local';
  const message = document.createElement('p');
  message.textContent =
    'Reintentá recargar la página o revisá el almacenamiento del navegador (por ejemplo, modo privado o espacio en disco).';
  errorShell.append(heading, message);
  root.append(errorShell);
}

void main().catch(renderStartupError);
