import { createMachine, assign } from 'xstate';

type Ctx = { percent: number };
type Ev = { type: 'TELEMETRY'; percent: number } | { type: 'RESET' };

export const coreLogicMachine = createMachine({
  id: 'coreLogic',
  initial: 'ok',
  context: { percent: 100 } as Ctx,
  on: {
    TELEMETRY: {
      actions: assign(({ event }) => ({ percent: event['percent'] })),
    },
    RESET: {
      actions: assign(() => ({ percent: 100 })),
    },
  },
  states: {
    ok: {
      always: { guard: ({ context }) => context.percent <= 30, target: 'low' },
    },
    low: {
      always: { guard: ({ context }) => context.percent <= 5, target: 'empty' },
    },
    empty: {},
  },
});
