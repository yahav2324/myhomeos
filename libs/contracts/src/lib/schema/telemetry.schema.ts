import { z } from 'zod';

export const TelemetrySchema = z.object({
  deviceId: z.string().min(1),
  quantity: z.number().nonnegative(),
  timestamp: z.string().datetime().optional(),
});

export type TelemetryInput = z.infer<typeof TelemetrySchema>;
