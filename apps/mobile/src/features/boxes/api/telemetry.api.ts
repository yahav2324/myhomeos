const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.173:3000';

export async function postTelemetry(input: {
  deviceId: string;
  quantity: number;
  timestamp?: string;
}) {
  const res = await fetch(`${API_URL}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok || json?.ok === false) throw new Error('Failed to post telemetry');
  return json;
}
