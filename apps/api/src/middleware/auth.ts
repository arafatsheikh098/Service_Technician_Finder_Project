import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifyAccessToken, type AuthUser, type Role } from '../lib/tokens.js';
import { isRevoked } from '../lib/revocation.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const verified = token ? verifyAccessToken(token) : null;
  if (!verified) return next(unauthorized());
  // Disabled/deleted accounts and changed passwords take effect immediately.
  if (await isRevoked(verified.id, verified.iat))
    return next(unauthorized('Session expired. Please log in again.'));
  req.user = { id: verified.id, role: verified.role };
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };

/** Use after requireAuth. Narrows `req.user` to non-null for handlers. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
