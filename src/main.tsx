import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { seedIfEmpty } from '@/composition/seed';
import { buildContainer } from '@/composition/container';
import { CampoProvider } from '@/ui/CampoProvider';
import { App } from '@/ui/App';

async function main() {
  const db = await openCampoDb();
  await seedIfEmpty(db);
  const container = buildContainer(db);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CampoProvider container={container}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
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
