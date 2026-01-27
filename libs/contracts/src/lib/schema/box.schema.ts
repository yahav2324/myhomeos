import { z } from 'zod';

export const BoxStateEnum = z.enum(['OK', 'LOW', 'EMPTY']);

export const BoxSchema = z.object({
  id: z.string().uuid(), // internal id
  code: z.string().min(2).max(40), // human id (rice-1)

  name: z.string().min(1),
  unit: z.enum(['g', 'ml']),

  // אופציונלי (תיאור/מגבלה פיזית)
  capacity: z.number().positive().optional(),

  // המשתמש מגדיר רק את זה פעם אחת
  fullQuantity: z.number().positive().optional(),

  // מגיע מהחיישן/משקל
  quantity: z.number().nonnegative().default(0),

  // מחושב בשרת אם יש fullQuantity
  percent: z.number().min(0).max(100).default(0),
  state: BoxStateEnum.default('EMPTY'),
  deviceId: z.string().min(1),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastReadingAt: z.string().datetime().optional(),
  householdId: z.string().uuid(),
});

export type Box = z.infer<typeof BoxSchema>;
