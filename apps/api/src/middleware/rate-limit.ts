import { rateLimit, type Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { Redis } from 'ioredis';
import { env, isTest } from '../config/env.js';

/**
 * Rate limiters backed by Redis so limits hold across multiple API instances.
 * Falls back to in-memory counters when no Redis client is provided (tests).
 */
export function createRateLimiters(redis?: Redis) {
  const make = (prefix: string, opts: Partial<Options>) =>
    rateLimit({
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => env.RATE_LIMIT_DISABLED,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down.' } },
      ...(redis && !isTest
        ? {
            store: new RedisStore({
              prefix: `rl:${prefix}:`,
              sendCommand: (command: string, ...args: string[]) =>
                redis.call(command, ...args) as Promise<RedisReply>,
            }),
          }
        : {}),
      ...opts,
    });

  return {
    global: make('global', { windowMs: 60_000, limit: 300 }),
    // Brute-force protection for credentials and email-sending endpoints.
    auth: make('auth', { windowMs: 15 * 60_000, limit: 20 }),
    ai: make('ai', { windowMs: 60_000, limit: 10 }),
    // Per-account brute-force protection: failed logins for one email, from any IP.
    loginPerAccount: make('login-acct', {
      windowMs: 15 * 60_000,
      limit: 10,
      skipSuccessfulRequests: true,
      keyGenerator: (req) =>
        `acct:${String((req.body as { email?: unknown })?.email ?? '')
          .trim()
          .toLowerCase()}`,
      message: {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many failed attempts for this account. Try again in 15 minutes.',
        },
      },
    }),
  };
}
