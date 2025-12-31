import { CreateBoxInput } from '@smart-kitchen/contracts';
import type { BoxItem } from '../model/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.173:3000';

export async function fetchBoxes(): Promise<BoxItem[]> {
  const res = await fetch(`${API_URL}/boxes`);

  if (!res.ok) {
    throw new Error(`Failed to load boxes (${res.status})`);
  }

  const json = await res.json();

  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as BoxItem[];
  }

  return json as BoxItem[];
}
export async function createBox(input: CreateBoxInput): Promise<BoxItem> {
  const res = await fetch(`${API_URL}/boxes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok || json?.ok === false) throw new Error('Failed to create box');
  return json.data as BoxItem;
}

export async function setFullLevel(id: string, fullQuantity: number): Promise<BoxItem> {
  const res = await fetch(`${API_URL}/boxes/${id}/set-full`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullQuantity }),
  });

  const json = await res.json();
  if (!res.ok || json?.ok === false) throw new Error('Failed to set full level');
  return json.data as BoxItem;
}

export async function recalibrateFullLevel(boxId: string, fullQuantity: number) {
  const res = await fetch(`${API_URL}/boxes/${boxId}/recalibrate-full`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fullQuantity }),
  });

  const json = await res.json();
  if (!res.ok || !json?.ok) {
    throw new Error(json?.errors?.formErrors?.[0] ?? 'Failed to recalibrate full level');
  }

  return json.data;
}
