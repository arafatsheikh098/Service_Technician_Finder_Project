import type { Redis } from 'ioredis';
import { logger } from './logger.js';

/**
 * Immediate access-token revocation.
 *
 * Access tokens are stateless JWTs, so on their own they stay valid until they
 * expire. When an account is disabled, deleted, changes its password, or a stolen
 * refresh token is detected, we record "tokens issued before <now> are dead" for
 * that user. requireAuth and the socket handshake check it on every request.
 *
 * Stored in Redis so every API instance sees it; kept for longer than any access
 * token can live. Falls back to process memory when Redis is not configured
 * (tests, single-instance dev).
 */
const KEY = (userId: string) => `revoked-before:${userId}`;
const TTL_SECONDS = 24 * 3600;

let redis: Redis | undefined;
const local = new Map<string, number>();

export function initRevocation(client?: Redis) {
  redis = client;
}

/** Revoke every access token issued up to and including this second. Returns that second. */
export async function revokeAccessTokens(userId: string): Promise<number> {
  const ts = Math.floor(Date.now() / 1000);
  local.set(userId, ts);
  if (redis) {
    await redis.set(KEY(userId), String(ts), 'EX', TTL_SECONDS).catch((err) => {
      logger.error({ err, userId }, 'Failed to store token revocation in Redis');
    });
  }
  return ts;
}

/** True if a token issued at `iat` (seconds) has been revoked for this user. */
export async function isRevoked(userId: string, iat: number): Promise<boolean> {
  let before = local.get(userId);
  if (redis) {
    try {
      const v = await redis.get(KEY(userId));
      if (v) before = Math.max(before ?? 0, Number(v));
    } catch (err) {
      // Fail open on a Redis outage: refresh tokens are still revoked in Postgres,
      // so the exposure is bounded by the short access-token lifetime.
      logger.warn({ err }, 'Revocation check unavailable');
    }
  }
  // JWT iat has 1-second precision, so a token minted in the same second as the
  // revocation counts as revoked. Tokens that must survive (the fresh token after a
  // password change) are minted with iat = revocation second + 1.
  return before !== undefined && iat <= before;
}
