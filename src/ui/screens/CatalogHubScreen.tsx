import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useClearAllData } from '@/ui/hooks/use-clear-all-data';
import { DataPortabilitySection } from '@/ui/components/DataPortabilitySection';

export function CatalogHubScreen() {
  const { clear } = useClearAllData();
  const [confirming, setConfirming] = useState(false);

  return (
    <main className="screen">
      <header className="list-header">
        <h1 className="screen-title">Catálogo</h1>
      </header>
      <ul className="catalog-menu">
        <li><Link className="field-row" to="/catalogo/zonas"><span className="field-name">Zonas</span><span className="chevron" aria-hidden="true">›</span></Link></li>
        <li><Link className="field-row" to="/catalogo/clientes"><span className="field-name">Clientes</span><span className="chevron" aria-hidden="true">›</span></Link></li>
        <li><Link className="field-row" to="/catalogo/lotes"><span className="field-name">Lotes</span><span className="chevron" aria-hidden="true">›</span></Link></li>
      </ul>

      <DataPortabilitySection />

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
    </main>
  );
}
