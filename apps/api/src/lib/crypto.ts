import { createHash, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

/** 256-bit random token, URL-safe. Used for refresh and password-reset tokens. */
export const randomToken = () => randomBytes(32).toString('base64url');

/** We only ever store SHA-256 hashes of bearer tokens, never the tokens themselves. */
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const hmacSha256 = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
