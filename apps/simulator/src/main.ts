import { createActor } from 'xstate';
import { coreLogicMachine } from '@smart-kitchen/core-logic';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const intervalMs = Number(process.env.TELEMETRY_INTERVAL_MS ?? 2000);
  const endpoint = process.env.API_URL ?? 'http://localhost:3000';

  console.log('[simulator] starting', { intervalMs, endpoint });

  // אם core-logic הוא XState machine, אפשר להריץ actor
  const actor = createActor(coreLogicMachine);
  actor.start();

  while (true) {
    // כאן תשלח Telemetry (דוגמה)
    const snapshot = actor.getSnapshot();
    console.log('[telemetry]', { state: snapshot.value });

    // TODO: POST ל-Nest API
    // await fetch(`${endpoint}/telemetry`, { method: 'POST', body: JSON.stringify(...) })

    await sleep(intervalMs);
  }
}

main().catch((e) => {
  console.error('[simulator] fatal', e);
  process.exit(1);
});
