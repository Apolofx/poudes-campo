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
    <main>
      <h1>Buscar lote</h1>
      <input
        aria-label="Buscar"
        value={query}
        onChange={onChange}
        placeholder="Lote, cliente o zona"
      />
      {loading && <p>Buscando…</p>}
      <ul>
        {results.map((r) => (
          <li key={r.field.id}>
            <Link to={`/field/${r.field.id}/record`}>
              {r.field.name} — {r.clientName} · {r.zoneName}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
