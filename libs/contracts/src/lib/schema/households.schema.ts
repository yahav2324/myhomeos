import { z } from 'zod';

export const CreateHouseholdSchema = z.object({
  name: z.string().min(2).max(60),
});

export type CreateHouseholdDto = z.infer<typeof CreateHouseholdSchema>;
