import * as React from 'react';
import { createHousehold } from '../api/households.api';

export function useCreateHousehold() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = React.useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      return await createHousehold(name);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create household');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { run, loading, error };
}
