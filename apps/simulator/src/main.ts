import { createActor } from 'xstate';
import { coreLogicMachine } from '@smart-kitchen/core-logic';

type Box = { id: string; name: string; capacity: number; unit: 'g' | 'ml' };
type Telemetry = {
  boxId: string;
  quantity: number;
  percent: number;
  state: 'OK' | 'LOW' | 'EMPTY';
  timestamp: string;
};

const actors = new Map<string, ReturnType<typeof createActor>>();

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function stateFromMachineValue(v: unknown): 'OK' | 'LOW' | 'EMPTY' {
  // machine states: 'ok' | 'low' | 'empty'
  if (v === 'low') return 'LOW';
  if (v === 'empty') return 'EMPTY';
  return 'OK';
}

async function fetchWithTimeout(url: string, ms = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function getBoxes(endpoint: string): Promise<Box[]> {
  const url = `${endpoint}/api/boxes`;
  console.log('[simulator] GET', url);

  const res = await fetchWithTimeout(url, 5000);
  if (!res.ok) throw new Error(`GET /api/boxes failed: ${res.status}`);

  const json = await res.json();
  const data = json?.ok ? json.data : json;
  if (!Array.isArray(data)) throw new Error('Invalid /api/boxes response');

  return data as Box[];
}
async function getLastTelemetry(endpoint: string, boxId: string) {
  const res = await fetch(`${endpoint}/api/telemetry/last?boxId=${encodeURIComponent(boxId)}`);
  if (!res.ok) return null;
  const json = await res.json();
  if (!json?.ok) return null;
  return json.data as { percent: number } | null;
}

async function postTelemetry(endpoint: string, t: Telemetry) {
  const res = await fetch(`${endpoint}/api/telemetry`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(t),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('POST /api/telemetry failed', res.status, body, t);
    throw new Error(`POST /api/telemetry failed: ${res.status}`);
  }
}

export async function runSimulator(endpoint: string) {
  const tickMs = 3000;
  const deltaPerTick = 2; // כמה % יורד כל tick

  while (true) {
    console.log('[simulator] tick', new Date().toISOString());

    try {
      const boxes = await getBoxes(endpoint);

      for (const box of boxes) {
        // 1) ensure actor
        let actor = actors.get(box.id);
        if (!actor) {
          actor = createActor(coreLogicMachine);
          actor.start();
          actors.set(box.id, actor);
        }

        // 2) sync from server (Refill מגיע מה־Mobile דרך Telemetry)
        const last = await getLastTelemetry(endpoint, box.id);
        if (last && typeof last.percent === 'number') {
          actor.send({ type: 'TELEMETRY', percent: clamp(last.percent, 0, 100) });
        }

        // 3) compute next percent
        const currentPercent = actor.getSnapshot().context.percent;
        const nextPercent = clamp(currentPercent - deltaPerTick, 0, 100);

        // 4) update machine with next percent
        actor.send({ type: 'TELEMETRY', percent: nextPercent });

        // 5) derive state from machine state
        const machineValue = actor.getSnapshot().value;
        const state = stateFromMachineValue(machineValue);

        const quantity = Math.round((box.capacity * nextPercent) / 100);

        await postTelemetry(endpoint, {
          boxId: box.id,
          percent: nextPercent,
          quantity,
          state,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('[simulator] tick error', e);
      // לא מפילים תהליך — ממשיכים לטיק הבא
    }
    await new Promise((r) => setTimeout(r, tickMs));
  }
}

async function main() {
  const endpoint = process.env.API_ENDPOINT ?? 'http://localhost:3000';

  console.log('[simulator] starting', {
    endpoint,
    now: new Date().toISOString(),
  });

  await runSimulator(endpoint);
}

main().catch((e) => {
  console.error('[simulator] fatal', e);
  process.exit(1);
});
