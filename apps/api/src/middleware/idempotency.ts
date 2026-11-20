import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { AppError, badRequest, unauthorized } from '../lib/errors.js';
import { sha256 } from '../lib/crypto.js';

/**
 * Idempotency-Key support (same idea as Stripe's API).
 *
 * Mobile networks drop responses. If a client retries "create booking" or "pay",
 * it must not create a second booking or charge twice. The client sends a unique
 * `Idempotency-Key` header; the first request's response is stored, and any retry
 * with the same key gets that stored response back instead of running again.
 *
 *  - same key + different body  -> 422 (client bug)
 *  - same key while first is still running -> 409, retry later
 *  - 5xx responses are not stored, so the client can retry them
 */
export function idempotency({ required }: { required: boolean }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.header('idempotency-key');
    if (!key) {
      if (required)
        return next(badRequest('The Idempotency-Key header is required for this request'));
      return next();
    }
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) return next(badRequest('Invalid Idempotency-Key'));
    if (!req.user) return next(unauthorized());

    const requestHash = sha256(
      `${req.method} ${req.originalUrl} ${JSON.stringify(req.body ?? null)}`,
    );
    const inserted = await pool.query(
      `INSERT INTO idempotency_keys (user_id, key, request_hash) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING key`,
      [req.user.id, key, requestHash],
    );

    if (inserted.rowCount === 0) {
      const { rows } = await pool.query<{
        request_hash: string;
        response_status: number | null;
        response_body: unknown;
      }>(
        'SELECT request_hash, response_status, response_body FROM idempotency_keys WHERE user_id = $1 AND key = $2',
        [req.user.id, key],
      );
      const saved = rows[0];
      if (!saved) return next(new AppError(409, 'REQUEST_IN_PROGRESS', 'Please retry'));
      if (saved.request_hash !== requestHash) {
        return next(
          new AppError(
            422,
            'IDEMPOTENCY_KEY_REUSED',
            'This Idempotency-Key was used for a different request',
          ),
        );
      }
      if (saved.response_status === null) {
        return next(
          new AppError(409, 'REQUEST_IN_PROGRESS', 'The original request is still being processed'),
        );
      }
      res.setHeader('Idempotent-Replayed', 'true');
      return res.status(saved.response_status).json(saved.response_body);
    }

    // Store the response *before* sending it, so a retry that arrives the instant
    // the client sees this response is guaranteed to find it.
    const userId = req.user.id;
    const originalJson = res.json.bind(res);
    res.json = (b: unknown) => {
      const store =
        res.statusCode >= 500
          ? pool.query('DELETE FROM idempotency_keys WHERE user_id = $1 AND key = $2', [
              userId,
              key,
            ])
          : pool.query(
              'UPDATE idempotency_keys SET response_status = $3, response_body = $4 WHERE user_id = $1 AND key = $2',
              [userId, key, res.statusCode, JSON.stringify(b ?? null)],
            );
      store.catch(() => {}).finally(() => originalJson(b));
      return res;
    };
    next();
  };
}
