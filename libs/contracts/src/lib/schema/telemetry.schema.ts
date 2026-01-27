import { z } from 'zod';

const SimpleSchema = z.object({
  deviceId: z.string().min(1),
  quantity: z.number().nonnegative(),
  percent: z.number().min(0).max(100).optional(),
  state: z.enum(['OK', 'LOW', 'EMPTY']).optional(),
  timestamp: z.string().datetime().optional(),
});

const HubSchema = z.object({
  hubId: z.string().min(1),
  boxId: z.string().min(1), // זה למעשה deviceId
  receivedAtMs: z.number().optional(),
  payload: z.object({
    quantity: z.number(),
    percent: z.number().optional(),
    state: z.enum(['OK', 'LOW', 'EMPTY']).optional(),
    unit: z.string().optional(),
    ts: z.number().optional(),
    boxId: z.string().optional(),
  }),
});

export const TelemetryIngestSchema = z.union([SimpleSchema, HubSchema]).transform((v) => {
  // Simple
  if ('deviceId' in v) {
    return {
      deviceId: v.deviceId,
      quantity: v.quantity,
      percent: v.percent ?? 0,
      state: v.state ?? 'OK',
      timestamp: v.timestamp ?? new Date().toISOString(),
    };
  }

  // Hub
  return {
    deviceId: v.boxId, // SK-BOX-001
    quantity: v.payload.quantity,
    percent: v.payload.percent ?? 0,
    state: v.payload.state ?? 'OK',
    timestamp: new Date().toISOString(), // אל תנסה להמיר ts שהוא uptime
  };
});

export type TelemetryNormalized = z.infer<typeof TelemetryIngestSchema>;
