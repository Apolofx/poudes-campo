import { Link } from 'react-router-dom';

export function CatalogHubScreen() {
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
    </main>
  );
}