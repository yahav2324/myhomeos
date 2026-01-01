import * as React from 'react';
import { API_URL } from '../api';

type TelemetryPoint = {
  boxId: string;
  quantity: number;
  percent: number;
  state: 'OK' | 'LOW' | 'EMPTY';
  timestamp: string;
};

export function useTelemetryHistory(boxId: string, hours: number) {
  const [items, setItems] = React.useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!boxId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/telemetry/history/${boxId}?hours=${hours}`);
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.errors?.formErrors?.[0] ?? 'Failed to load history');
      }

      const data = Array.isArray(json.data) ? (json.data as TelemetryPoint[]) : [];
      // newest first
      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setItems(data);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [boxId, hours]);

  React.useEffect(() => {
    load();
  }, [load]);

  return { items, loading, err, reload: load };
}
