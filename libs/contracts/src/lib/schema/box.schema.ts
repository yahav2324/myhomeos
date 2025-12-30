import { z } from 'zod';

export const BoxSchema = z.object({
  id: z.string(), // boxId
  name: z.string(), // “Rice”, “Sugar”
  capacity: z.number().positive(), // גרמים
  unit: z.enum(['g', 'ml']),
  createdAt: z.string(),
});

export type Box = z.infer<typeof BoxSchema>;
