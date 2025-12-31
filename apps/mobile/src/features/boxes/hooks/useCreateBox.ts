import * as React from 'react';
import { createBox } from '../api/boxes.api';
import type { CreateBoxInput } from '@smart-kitchen/contracts';

export function useCreateBox() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = React.useCallback(async (input: CreateBoxInput) => {
    setLoading(true);
    setError(null);
    try {
      return await createBox(input);
    } catch (e: any) {
      setError(e?.message ?? 'Create failed');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit, loading, error };
}
