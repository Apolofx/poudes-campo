import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchFields } from '@/ui/hooks/use-search-fields';

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
    <main className="screen search">
      <header className="search-header">
        <h1 className="screen-title">Buscar lote</h1>
        <div className="search-box">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
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
                  <span className="field-sub">{r.clientName} · {r.zoneName}</span>
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
