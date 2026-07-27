import { useCallback, useState } from 'react';
import type { FieldSearchResult } from '@/domain/services/field-search';
import { useCampo } from '@/ui/CampoProvider';

export function useSearchFields() {
  const { searchFields } = useCampo();
  const [results, setResults] = useState<FieldSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const search = useCallback(
    async (query: string) => {
      setLoading(true);
      setError(undefined);
      try {
        setResults(await searchFields.execute(query));
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    },
    [searchFields],
  );

  return { results, loading, error, search };
}
