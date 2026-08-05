import { useCallback, useState } from 'react';
import type {
  CreateFieldEnsuringInput,
  CreateFieldEnsuringResult,
} from '@/application/use-cases/create-field-ensuring';
import { useCampo } from '@/ui/CampoProvider';

export function useCreateFieldEnsuring() {
  const { createFieldEnsuring } = useCampo();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const submit = useCallback(
    async (input: CreateFieldEnsuringInput): Promise<CreateFieldEnsuringResult | undefined> => {
      setSubmitting(true);
      setError(undefined);
      try {
        return await createFieldEnsuring.execute(input);
      } catch (e) {
        setError(e as Error);
        return undefined;
      } finally {
        setSubmitting(false);
      }
    },
    [createFieldEnsuring],
  );

  return { submit, submitting, error };
}
