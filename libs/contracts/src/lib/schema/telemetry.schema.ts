import { z } from 'zod';

export const TelemetrySchema = z.object({
  boxId: z.string(),
  quantity: z.number().nonnegative(),
  percent: z.number().min(0).max(100),
  state: z.enum(['OK', 'LOW', 'EMPTY']),
  timestamp: z.string(),
});

export type Telemetry = z.infer<typeof TelemetrySchema>;
