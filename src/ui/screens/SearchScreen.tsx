import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useSearchFields } from '@/ui/hooks/use-search-fields';
import { clientLabel, zoneLabel } from '@/ui/labels';

export function SearchScreen() {
  const { results, search, loading } = useSearchFields();
  const [query, setQuery] = useState('');

  useEffect(() => {
    search('');
  }, [search]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    search(value);
  };

  return (
    <main className="screen">
      <header className="search-header">
        <h1 className="screen-title">Buscar lote</h1>
        <div className="search-box">
          <Search className="search-icon" size={18} aria-hidden="true" />
          <input
            className="search-input"
            aria-label="Buscar"
            value={query}
            onChange={onChange}
            placeholder="Lote, cliente o zona"
          />
        </div>
      </header>

      {loading && <p className="hint">Buscando…</p>}

      {query !== '' && !loading && results.length === 0 ? (
        <p className="empty">No se encontró ningún lote.</p>
      ) : (
        <ul className="field-list">
          {results.map((r) => (
            <li key={r.field.id}>
              <Link className="field-row" to={`/field/${r.field.id}/record`}>
                <span className="field-text">
                  <span className="field-name">{r.field.name}</span>
                  <span className="field-sub">{clientLabel(r.clientName)} · {zoneLabel(r.zoneName)}</span>
                </span>
                <span className="chevron" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
