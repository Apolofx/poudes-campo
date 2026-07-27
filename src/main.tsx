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

void main();
