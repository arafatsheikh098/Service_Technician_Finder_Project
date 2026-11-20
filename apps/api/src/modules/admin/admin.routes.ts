import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';
import type { Deps } from '../../lib/deps.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { revokeAccessTokens } from '../../lib/revocation.js';
import { registry, errors, secured } from '../../docs/openapi.js';

const IdParams = z.object({ id: z.uuid() });
const TechListQuery = z.object({
  verified: z.enum(['true', 'false']).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export function adminRouter(deps: Deps) {
  const r = Router();
  r.use(requireAuth, requireRole('admin'));

  r.get('/stats', async (_req, res) => {
    const [users, bookings, revenue, pending, daily] = await Promise.all([
      pool.query(`SELECT role, count(*)::int AS n FROM users GROUP BY role`),
      pool.query(`SELECT status, count(*)::int AS n FROM bookings GROUP BY status`),
      pool.query(
        `SELECT COALESCE(sum(amount_bdt), 0)::int AS total FROM payments WHERE status = 'succeeded'`,
      ),
      pool.query(`SELECT count(*)::int AS n FROM technician_profiles WHERE NOT is_verified`),
      pool.query(
        `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(b.id)::int AS bookings
           FROM generate_series(current_date - 13, current_date, interval '1 day') d
           LEFT JOIN bookings b ON b.created_at::date = d::date
          GROUP BY d ORDER BY d`,
      ),
    ]);
    res.json({
      usersByRole: Object.fromEntries(users.rows.map((r) => [r.role, r.n])),
      bookingsByStatus: Object.fromEntries(bookings.rows.map((r) => [r.status, r.n])),
      revenueBdt: revenue.rows[0].total,
      pendingVerifications: pending.rows[0].n,
      bookingsLast14Days: daily.rows,
    });
  });

  r.get('/technicians', async (req, res) => {
    const q = parse(TechListQuery, req.query);
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.verified) {
      params.push(q.verified === 'true');
      where.push(`t.is_verified = $${params.length}`);
    }
    if (q.q) {
      params.push(`%${q.q}%`);
      where.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await pool.query(
      `SELECT count(*)::int AS n FROM technician_profiles t JOIN users u ON u.id = t.user_id ${whereSql}`,
      params,
    );
    params.push(q.pageSize, (q.page - 1) * q.pageSize);
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name AS "fullName", u.email, u.phone, u.is_active AS "isActive",
              u.created_at AS "createdAt", t.is_verified AS "isVerified", t.area_label AS "areaLabel",
              t.experience_years AS "experienceYears", t.hourly_rate_bdt AS "hourlyRateBdt",
              t.jobs_completed AS "jobsCompleted",
              CASE WHEN t.rating_count > 0 THEN round(t.rating_sum::numeric / t.rating_count, 1) END AS "ratingAvg",
              ARRAY(SELECT c.name FROM technician_services ts JOIN service_categories c ON c.id = ts.category_id
                     WHERE ts.technician_id = t.user_id ORDER BY c.name) AS categories
         FROM technician_profiles t JOIN users u ON u.id = t.user_id
         ${whereSql}
        ORDER BY t.is_verified, u.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ items: rows, page: q.page, pageSize: q.pageSize, total: total.rows[0].n });
  });

  r.post('/technicians/:id/verification', async (req, res) => {
    const { id } = parse(IdParams, req.params);
    const { verified } = parse(z.object({ verified: z.boolean() }), req.body);
    const { rowCount } = await pool.query(
      'UPDATE technician_profiles SET is_verified = $2 WHERE user_id = $1',
      [id, verified],
    );
    if (!rowCount) throw notFound('Technician');
    deps.realtime.toUser(id, 'profile.verification', { verified });
    res.json({ id, verified });
  });

  r.post('/users/:id/status', async (req, res) => {
    const { id } = parse(IdParams, req.params);
    const { active } = parse(z.object({ active: z.boolean() }), req.body);
    await withTransaction(async (tx) => {
      const { rowCount } = await tx.query(
        `UPDATE users SET is_active = $2 WHERE id = $1 AND role <> 'admin'`,
        [id, active],
      );
      if (!rowCount) throw notFound('User');
      if (!active) {
        await tx.query(
          'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
          [id],
        );
        // A disabled technician must also disappear from search.
        await tx.query('UPDATE technician_profiles SET is_available = false WHERE user_id = $1', [
          id,
        ]);
      }
    });
    if (!active) {
      // Disabling an account ends every session right now: refresh tokens (above),
      // live access tokens, and open WebSocket connections.
      await revokeAccessTokens(id);
      deps.realtime.disconnectUser(id);
    }
    res.json({ id, active });
  });

  return r;
}

const tag = ['Admin'];
registry.registerPath({
  method: 'get',
  path: '/admin/stats',
  tags: tag,
  security: secured,
  summary: 'Platform metrics',
  responses: { 200: { description: 'Stats' }, 403: errors[403] },
});
registry.registerPath({
  method: 'get',
  path: '/admin/technicians',
  tags: tag,
  security: secured,
  summary: 'Technicians, unverified first',
  request: { query: TechListQuery },
  responses: { 200: { description: 'Page of technicians' }, 403: errors[403] },
});
registry.registerPath({
  method: 'post',
  path: '/admin/technicians/{id}/verification',
  tags: tag,
  security: secured,
  summary: 'Verify or un-verify a technician (only verified technicians appear in search)',
  request: {
    params: IdParams,
    body: { content: { 'application/json': { schema: z.object({ verified: z.boolean() }) } } },
  },
  responses: { 200: { description: 'Updated' }, 404: errors[404] },
});
registry.registerPath({
  method: 'post',
  path: '/admin/users/{id}/status',
  tags: tag,
  security: secured,
  summary: 'Enable or disable a user account',
  request: {
    params: IdParams,
    body: { content: { 'application/json': { schema: z.object({ active: z.boolean() }) } } },
  },
  responses: { 200: { description: 'Updated' }, 404: errors[404] },
});
