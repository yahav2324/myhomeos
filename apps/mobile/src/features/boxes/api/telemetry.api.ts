import { authedFetch } from '../../auth/api/auth.api';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.173:3000/api';

export async function postTelemetry(input: {
  deviceId: string;
  quantity: number;
  timestamp?: string;
}) {
  const res = await fetch(`/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.errors?.formErrors?.[0] ?? 'Failed to post telemetry');
  }

  return json;
}
