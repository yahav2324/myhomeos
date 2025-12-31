import { z } from 'zod';

export const CreateBoxSchema = z.object({
  deviceId: z.string().min(1),
  name: z.string().min(1),
  unit: z.enum(['g', 'ml']),
  capacity: z.number().positive().optional(),
});

export type CreateBoxInput = z.infer<typeof CreateBoxSchema>;
