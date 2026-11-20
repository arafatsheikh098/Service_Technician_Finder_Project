import type { z } from 'zod';

/**
 * Parse untrusted input with a zod schema. Throws ZodError, which the error
 * handler turns into a 400 with field-level details.
 */
export const parse = <S extends z.ZodType>(schema: S, data: unknown): z.infer<S> =>
  schema.parse(data);
