import { ShoppingCategory, ShoppingUnit } from '@prisma/client';
import z from 'zod';

export const UpsertMyDefaultsSchema = z.object({
  category: z.nativeEnum(ShoppingCategory).nullable().optional(),
  unit: z.nativeEnum(ShoppingUnit).nullable().optional(), // PCS|G|KG|ML|L
  qty: z.number().positive().nullable().optional(),
  extras: z.record(z.string(), z.string()).nullable().optional(),
});
