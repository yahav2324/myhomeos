import { CreateBoxInput } from '@smart-kitchen/contracts';
import type { BoxItem } from '../model/types';
import { authedFetch } from '../../auth/api/auth.api';

// חשוב: Base בלי /api – authedFetch כבר מוסיף
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:3000/api';

// =========================
// GET /boxes
// =========================
export async function fetchBoxes(): Promise<BoxItem[]> {
  const res = await authedFetch('/boxes', { method: 'GET' });

  if (!res.ok) {
    throw new Error(`Failed to load boxes (${res.status})`);
  }

  const json = await res.json();
  return json?.data ?? [];
}

// =========================
// POST /boxes
// =========================
export async function createBox(input: CreateBoxInput): Promise<BoxItem> {
  const res = await authedFetch('/boxes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.errors?.formErrors?.[0] ?? 'Failed to create box');
  }

  return json.data as BoxItem;
}

// =========================
// PATCH /boxes/:id/set-full
// =========================
export async function setFullLevel(boxId: string, fullQuantity: number): Promise<BoxItem> {
  const res = await authedFetch(`/boxes/${boxId}/set-full`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullQuantity }),
  });

  const json = await res.json();
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.errors?.formErrors?.[0] ?? 'Failed to set full level');
  }

  return json.data as BoxItem;
}

// =========================
// POST /boxes/:id/recalibrate-full
// =========================
export async function recalibrateFullLevel(boxId: string, fullQuantity: number): Promise<BoxItem> {
  const res = await authedFetch(`/boxes/${boxId}/recalibrate-full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullQuantity }),
  });

  const json = await res.json();
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.errors?.formErrors?.[0] ?? 'Failed to recalibrate full level');
  }

  return json.data as BoxItem;
}
