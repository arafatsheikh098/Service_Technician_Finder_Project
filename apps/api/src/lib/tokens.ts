import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type Role = 'customer' | 'technician' | 'admin';
export interface AuthUser {
  id: string;
  role: Role;
}

const ISSUER = 'techfinder';
const AUDIENCE = 'techfinder-api';

export function signAccessToken(user: AuthUser, opts: { issuedAt?: number } = {}): string {
  const payload: Record<string, unknown> = { role: user.role };
  if (opts.issuedAt) payload.iat = opts.issuedAt;
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'HS256',
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

/** Returns the user, or null if the token is missing, expired, forged or malformed. */
export function verifyAccessToken(token: string): (AuthUser & { iat: number }) | null {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (typeof payload === 'string' || !payload.sub) return null;
    const role = (payload as { role?: unknown }).role;
    if (role !== 'customer' && role !== 'technician' && role !== 'admin') return null;
    return { id: payload.sub, role, iat: payload.iat ?? 0 };
  } catch {
    return null;
  }
}
