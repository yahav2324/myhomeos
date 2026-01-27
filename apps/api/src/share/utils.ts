import { Box } from '@smart-kitchen/contracts';

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // spaces & symbols -> '-'
    .replace(/(^-|-$)/g, '');
}

export function makeCode(name: string, existingCodes: string[]) {
  const base = slugify(name) || 'box';
  const sameBase = existingCodes.filter((c) => c === base || c.startsWith(`${base}-`));

  if (sameBase.length === 0) return `${base}-1`;

  // find next number
  let max = 0;
  for (const c of sameBase) {
    const m = c.match(new RegExp(`^${base}-(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${base}-${max + 1}`;
}

export function computeState(percent: number): Box['state'] {
  if (percent <= 0) return 'EMPTY';
  if (percent < 30) return 'LOW';
  return 'OK';
}

export function computePercent(quantity: number, fullQuantity?: number) {
  if (!fullQuantity || fullQuantity <= 0) return 0;
  const p = Math.round((quantity / fullQuantity) * 100);
  return Math.max(0, Math.min(100, p));
}

export function toContract(row: any): Box {
  return {
    id: row.id,
    code: row.code,
    deviceId: row.deviceId,

    householdId: row.householdId,
    name: row.name,
    unit: row.unit,
    capacity: row.capacity ?? undefined,

    fullQuantity: row.fullQuantity ?? undefined,
    quantity: row.quantity,
    percent: row.percent,
    state: row.state,

    // 👇 ההבדל הקריטי
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastReadingAt: row.lastReadingAt ? row.lastReadingAt.toISOString() : undefined,
  };
}
