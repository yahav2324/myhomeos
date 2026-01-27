import { authedFetch } from '../../auth/api/auth.api';

export async function createHousehold(name: string) {
  const res = await authedFetch('/households', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || json?.ok === false) {
    throw new Error(json?.message ?? json?.errors?.formErrors?.[0] ?? `HTTP ${res.status}`);
  }

  return json?.data ?? json;
}

export async function myHouseholds() {
  const res = await authedFetch('/households/me', { method: 'GET' });
  const json = await res.json().catch(() => null);

  if (!res.ok || json?.ok === false) {
    throw new Error(json?.message ?? json?.errors?.formErrors?.[0] ?? `HTTP ${res.status}`);
  }

  return json?.data ?? json;
}
