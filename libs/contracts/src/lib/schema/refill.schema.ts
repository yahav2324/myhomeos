import { z } from 'zod';

export const RefillBoxSchema = z
  .object({
    quantity: z.number().nonnegative().optional(),
    percent: z.number().min(0).max(100).optional(),
  })
  .refine((v) => v.quantity !== undefined || v.percent !== undefined, {
    message: 'Provide quantity or percent',
  });

export type RefillBoxInput = z.infer<typeof RefillBoxSchema>;
