import { ZodSchema } from 'zod';

export function parseOrThrow<T>(schema: ZodSchema<T>, input: unknown): T {
  const res = schema.safeParse(input);
  if (!res.success) {
    const message = res.error.issues.map((i) => i.message).join(', ');
    throw new Error(message);
  }
  return res.data;
}
