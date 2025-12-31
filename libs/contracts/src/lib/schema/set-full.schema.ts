import z from 'zod';

export const SetFullSchema = z.object({
  fullQuantity: z.number().positive(),
});
