import { z } from 'zod';
import type pg from 'pg';
import { env } from '../../config/env.js';
import { pool, withTransaction, pgCode, PgError, type Queryable } from '../../db/pool.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import type { AuthUser } from '../../lib/tokens.js';
import type { Deps } from '../../lib/deps.js';
import {
  BOOKING_STATUSES,
  allowedTransitions,
  canTransition,
  type BookingStatus,
} from './booking-state.js';

const MAX_DAYS_AHEAD = 60;
export const MAX_ACTIVE_PER_CUSTOMER = 10;

export const CreateBookingBody = z
  .object({
    technicianId: z.uuid(),
    category: z.string().max(50).describe('Category slug'),
    startAt: z.iso.datetime({ offset: true }),
    durationHours: z.number().int().min(1).max(8).default(2),
    address: z.string().trim().min(3).max(300),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    problemDescription: z.string().trim().max(2000).optional(),
  })
  .meta({ id: 'CreateBooking' });

export const TransitionBody = z
  .object({
    to: z.enum(BOOKING_STATUSES),
    reason: z.string().trim().max(500).optional(),
  })
  .meta({ id: 'BookingTransition' });

export const ListBookingsQuery = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  scope: z.enum(['active', 'past', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

interface BookingRow {
  id: string;
  customer_id: string;
  technician_id: string;
  status: BookingStatus;
}

/** Shared SELECT used by list and detail views. */
const BOOKING_VIEW = `
  SELECT b.id, b.status, b.address, b.problem_description AS "problemDescription",
         b.quoted_price_bdt AS "quotedPriceBdt", b.cancel_reason AS "cancelReason",
         lower(b.slot) AS "startAt", upper(b.slot) AS "endAt",
         ST_Y(b.location::geometry) AS lat, ST_X(b.location::geometry) AS lng,
         b.created_at AS "createdAt", b.updated_at AS "updatedAt",
         json_build_object('id', c.id, 'slug', c.slug, 'name', c.name) AS category,
         -- Phone numbers are only shared once the technician has accepted the job, so they
         -- can't be harvested by creating and cancelling bookings.
         json_build_object('id', cu.id, 'fullName', cu.full_name,
                           'phone', CASE WHEN b.status IN ('accepted','en_route','in_progress','completed') THEN cu.phone END) AS customer,
         json_build_object('id', tu.id, 'fullName', tu.full_name,
                           'phone', CASE WHEN b.status IN ('accepted','en_route','in_progress','completed') THEN tu.phone END,
                           'avatarUrl', tu.avatar_url) AS technician,
         (SELECT p.status FROM payments p WHERE p.booking_id = b.id
           ORDER BY (p.status = 'succeeded') DESC, p.created_at DESC LIMIT 1) AS "paymentStatus",
         (SELECT json_build_object('rating', r.rating, 'comment', r.comment)
            FROM reviews r WHERE r.booking_id = b.id) AS review
    FROM bookings b
    JOIN service_categories c ON c.id = b.category_id
    JOIN users cu ON cu.id = b.customer_id
    JOIN users tu ON tu.id = b.technician_id`;

/** Load a booking and check the caller is a party to it (or an admin). */
async function loadForUser(db: Queryable, id: string, user: AuthUser, lock = false) {
  const { rows } = await db.query<BookingRow>(
    `SELECT id, customer_id, technician_id, status FROM bookings WHERE id = $1 ${lock ? 'FOR UPDATE' : ''}`,
    [id],
  );
  const b = rows[0];
  // 404 rather than 403 for other people's bookings, so IDs can't be probed.
  if (!b) throw notFound('Booking');
  if (user.role !== 'admin' && b.customer_id !== user.id && b.technician_id !== user.id) {
    throw notFound('Booking');
  }
  return b;
}

export function createBookingsService(deps: Deps) {
  const bookingUrl = (id: string) => `${env.APP_URL}/bookings/${id}`;

  async function getBooking(id: string, user: AuthUser) {
    await loadForUser(pool, id, user);
    const { rows } = await pool.query(`${BOOKING_VIEW} WHERE b.id = $1`, [id]);
    const events = await pool.query(
      `SELECT e.from_status AS "from", e.to_status AS "to", e.note, e.created_at AS "at",
              u.full_name AS "actorName"
         FROM booking_events e LEFT JOIN users u ON u.id = e.actor_id
        WHERE e.booking_id = $1 ORDER BY e.id`,
      [id],
    );
    const booking = rows[0];
    return {
      ...booking,
      // loadForUser already guaranteed the caller is a party (or admin).
      allowedTransitions: allowedTransitions(booking.status, user.role),
      timeline: events.rows,
    };
  }

  return {
    getBooking,

    async create(customer: AuthUser, input: z.infer<typeof CreateBookingBody>) {
      const start = new Date(input.startAt);
      const now = Date.now();
      if (start.getTime() < now + 15 * 60_000)
        throw badRequest('Bookings must start at least 15 minutes from now');
      if (start.getTime() > now + MAX_DAYS_AHEAD * 86_400_000) {
        throw badRequest(`Bookings can be made at most ${MAX_DAYS_AHEAD} days ahead`);
      }
      const end = new Date(start.getTime() + input.durationHours * 3_600_000);

      // Anti-abuse: a customer can't hold more than MAX_ACTIVE open bookings, so nobody
      // can block technicians' calendars with throwaway requests.
      const active = await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM bookings
          WHERE customer_id = $1 AND status IN ('pending','accepted','en_route','in_progress')`,
        [customer.id],
      );
      if (active.rows[0]!.n >= MAX_ACTIVE_PER_CUSTOMER) {
        throw conflict(
          `You already have ${MAX_ACTIVE_PER_CUSTOMER} open bookings. Complete or cancel one first.`,
          'TOO_MANY_ACTIVE_BOOKINGS',
        );
      }

      const created = await withTransaction(async (tx) => {
        // Check the technician can actually take this job before reserving the slot.
        const { rows } = await tx.query<{
          category_id: number | null;
          base_price_bdt: number | null;
          hourly_rate_bdt: number;
          is_verified: boolean;
          is_available: boolean;
          in_range: boolean;
          email: string;
          full_name: string;
        }>(
          `SELECT ts.category_id, c.base_price_bdt, t.hourly_rate_bdt, t.is_verified, t.is_available,
                  ST_DWithin(t.location, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
                             t.service_radius_km * 1000) AS in_range,
                  u.email, u.full_name
             FROM technician_profiles t
             JOIN users u ON u.id = t.user_id AND u.is_active
             LEFT JOIN service_categories c ON c.slug = $2
             LEFT JOIN technician_services ts ON ts.technician_id = t.user_id AND ts.category_id = c.id
            WHERE t.user_id = $1`,
          [input.technicianId, input.category, input.lng, input.lat],
        );
        const tech = rows[0];
        if (!tech || !tech.is_verified) throw notFound('Technician');
        if (!tech.is_available)
          throw conflict('This technician is not taking jobs right now', 'TECHNICIAN_UNAVAILABLE');
        if (!tech.category_id) throw badRequest('This technician does not offer that service');
        if (!tech.in_range)
          throw badRequest('This address is outside the technician’s service area');

        const quoted = Math.max(
          tech.base_price_bdt ?? 0,
          tech.hourly_rate_bdt * input.durationHours,
        );

        let booking: { id: string };
        try {
          const ins = await tx.query<{ id: string }>(
            `INSERT INTO bookings (customer_id, technician_id, category_id, slot, address, location,
                                   problem_description, quoted_price_bdt)
             VALUES ($1, $2, $3, tstzrange($4, $5, '[)'),
                     $6, ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography, $9, $10)
             RETURNING id`,
            [
              customer.id,
              input.technicianId,
              tech.category_id,
              start,
              end,
              input.address,
              input.lng,
              input.lat,
              input.problemDescription ?? null,
              quoted,
            ],
          );
          booking = ins.rows[0]!;
        } catch (err) {
          // The exclusion constraint is the single source of truth for availability.
          if (pgCode(err) === PgError.EXCLUSION_VIOLATION) {
            throw conflict(
              'That time slot was just taken. Please pick another time.',
              'SLOT_TAKEN',
            );
          }
          if (pgCode(err) === PgError.CHECK_VIOLATION) throw badRequest('Invalid booking');
          throw err;
        }

        await tx.query(
          `UPDATE technician_profiles SET jobs_offered = jobs_offered + 1 WHERE user_id = $1`,
          [input.technicianId],
        );
        await tx.query(
          `INSERT INTO booking_events (booking_id, from_status, to_status, actor_id) VALUES ($1, NULL, 'pending', $2)`,
          [booking.id, customer.id],
        );
        const c = await tx.query<{ full_name: string }>(
          'SELECT full_name FROM users WHERE id = $1',
          [customer.id],
        );
        return { id: booking.id, tech, customerName: c.rows[0]!.full_name };
      });

      const view = await getBooking(created.id, customer);
      deps.realtime.toUser(input.technicianId, 'booking.created', { bookingId: created.id });
      await deps.notifier.send({
        type: 'booking_requested',
        to: created.tech.email,
        technicianName: created.tech.full_name,
        customerName: created.customerName,
        service: input.category,
        when: start.toISOString(),
        bookingUrl: bookingUrl(created.id),
      });
      return view;
    },

    /** Numbers for the customer/technician dashboard, scoped to the caller's own bookings. */
    async summary(user: AuthUser) {
      if (user.role === 'admin') throw forbidden('Admins use /admin/stats');
      const col = user.role === 'customer' ? 'customer_id' : 'technician_id';
      const [counts, money, monthly, next] = await Promise.all([
        pool.query<{ status: BookingStatus; n: number }>(
          `SELECT status, count(*)::int AS n FROM bookings WHERE ${col} = $1 GROUP BY status`,
          [user.id],
        ),
        pool.query<{ total: number; this_month: number }>(
          `SELECT COALESCE(sum(p.amount_bdt), 0)::int AS total,
                  COALESCE(sum(p.amount_bdt) FILTER (WHERE p.updated_at >= date_trunc('month', now())), 0)::int AS this_month
             FROM payments p JOIN bookings b ON b.id = p.booking_id
            WHERE b.${col} = $1 AND p.status = 'succeeded'`,
          [user.id],
        ),
        // Completed jobs per month for the last 6 months (value = quoted price of completed jobs).
        pool.query<{ month: string; jobs: number; amount: number }>(
          `SELECT to_char(m, 'YYYY-MM') AS month,
                  count(b.id)::int AS jobs,
                  COALESCE(sum(b.quoted_price_bdt), 0)::int AS amount
             FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
             LEFT JOIN bookings b ON b.${col} = $1 AND b.status = 'completed'
                                  AND date_trunc('month', lower(b.slot)) = m
            GROUP BY m ORDER BY m`,
          [user.id],
        ),
        pool.query(
          `${BOOKING_VIEW} WHERE b.${col} = $1 AND b.status IN ('pending','accepted','en_route','in_progress')
            ORDER BY lower(b.slot) LIMIT 1`,
          [user.id],
        ),
      ]);
      const byStatus = Object.fromEntries(counts.rows.map((r) => [r.status, r.n])) as Partial<
        Record<BookingStatus, number>
      >;
      const active =
        (byStatus.pending ?? 0) +
        (byStatus.accepted ?? 0) +
        (byStatus.en_route ?? 0) +
        (byStatus.in_progress ?? 0);
      return {
        role: user.role,
        byStatus,
        activeCount: active,
        completedCount: byStatus.completed ?? 0,
        pendingRequests: byStatus.pending ?? 0,
        paidTotalBdt: money.rows[0]!.total,
        paidThisMonthBdt: money.rows[0]!.this_month,
        monthly: monthly.rows,
        nextBooking: next.rows[0] ?? null,
      };
    },

    async list(user: AuthUser, q: z.infer<typeof ListBookingsQuery>) {
      const where: string[] = [];
      const params: unknown[] = [];
      if (user.role === 'customer') {
        params.push(user.id);
        where.push(`b.customer_id = $${params.length}`);
      } else if (user.role === 'technician') {
        params.push(user.id);
        where.push(`b.technician_id = $${params.length}`);
      }
      if (q.status) {
        params.push(q.status);
        where.push(`b.status = $${params.length}`);
      }
      if (q.scope === 'active')
        where.push(`b.status IN ('pending','accepted','en_route','in_progress')`);
      if (q.scope === 'past') where.push(`b.status IN ('completed','cancelled','rejected')`);
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const total = await pool.query<{ n: number }>(
        `SELECT count(*) AS n FROM bookings b ${whereSql}`,
        params,
      );
      params.push(q.pageSize, (q.page - 1) * q.pageSize);
      const { rows } = await pool.query(
        `${BOOKING_VIEW} ${whereSql}
          ORDER BY lower(b.slot) ${q.scope === 'past' ? 'DESC' : 'ASC'}
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
      return { items: rows, page: q.page, pageSize: q.pageSize, total: total.rows[0]!.n };
    },

    async transition(user: AuthUser, id: string, input: z.infer<typeof TransitionBody>) {
      const result = await withTransaction(async (tx: pg.PoolClient) => {
        // Row lock: two concurrent transitions on the same booking are serialised.
        const b = await loadForUser(tx, id, user, true);
        if (!canTransition(b.status, input.to, user.role)) {
          throw new AppError(
            409,
            'INVALID_TRANSITION',
            `A ${user.role} cannot move a booking from ${b.status} to ${input.to}`,
            { allowed: allowedTransitions(b.status, user.role) },
          );
        }
        if (input.to === 'cancelled' && !input.reason)
          throw badRequest('Please give a reason for cancelling');

        await tx.query(
          `UPDATE bookings SET status = $2, cancel_reason = COALESCE($3, cancel_reason) WHERE id = $1`,
          [id, input.to, input.to === 'cancelled' ? input.reason : null],
        );
        if (input.to === 'accepted') {
          await tx.query(
            'UPDATE technician_profiles SET jobs_accepted = jobs_accepted + 1 WHERE user_id = $1',
            [b.technician_id],
          );
        }
        if (input.to === 'completed') {
          await tx.query(
            'UPDATE technician_profiles SET jobs_completed = jobs_completed + 1 WHERE user_id = $1',
            [b.technician_id],
          );
        }
        await tx.query(
          `INSERT INTO booking_events (booking_id, from_status, to_status, actor_id, note)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, b.status, input.to, user.id, input.reason ?? null],
        );
        return b;
      });

      const view = await getBooking(id, user);
      const payload = { bookingId: id, status: input.to };
      deps.realtime.toBooking(id, 'booking.updated', payload);
      deps.realtime.toUser(result.customer_id, 'booking.updated', payload);
      deps.realtime.toUser(result.technician_id, 'booking.updated', payload);

      // Email whichever party did not make the change.
      const otherId = user.id === result.customer_id ? result.technician_id : result.customer_id;
      const other = await pool.query<{ email: string; full_name: string }>(
        'SELECT email, full_name FROM users WHERE id = $1',
        [otherId],
      );
      if (other.rows[0]) {
        await deps.notifier.send({
          type: 'booking_status',
          to: other.rows[0].email,
          name: other.rows[0].full_name,
          status: input.to,
          service: view.category.name,
          bookingUrl: bookingUrl(id),
        });
      }
      return view;
    },

    async review(user: AuthUser, id: string, input: { rating: number; comment?: string }) {
      const b = await loadForUser(pool, id, user);
      if (b.customer_id !== user.id) throw forbidden('Only the customer can review this booking');
      if (b.status !== 'completed')
        throw conflict('You can review a job once it is completed', 'NOT_COMPLETED');
      try {
        await pool.query(
          `INSERT INTO reviews (booking_id, customer_id, technician_id, rating, comment)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, user.id, b.technician_id, input.rating, input.comment ?? null],
        );
      } catch (err) {
        if (pgCode(err) === PgError.UNIQUE_VIOLATION)
          throw conflict('You already reviewed this booking', 'ALREADY_REVIEWED');
        throw err;
      }
      deps.realtime.toUser(b.technician_id, 'review.created', {
        bookingId: id,
        rating: input.rating,
      });
      return getBooking(id, user);
    },

    async listMessages(user: AuthUser, id: string, afterId = 0) {
      await loadForUser(pool, id, user);
      const { rows } = await pool.query(
        `SELECT m.id, m.body, m.created_at AS "createdAt", m.sender_id AS "senderId",
                u.full_name AS "senderName"
           FROM messages m JOIN users u ON u.id = m.sender_id
          WHERE m.booking_id = $1 AND m.id > $2 ORDER BY m.id LIMIT 200`,
        [id, afterId],
      );
      return { items: rows };
    },

    async sendMessage(user: AuthUser, id: string, body: string) {
      const b = await loadForUser(pool, id, user);
      if (user.id !== b.customer_id && user.id !== b.technician_id) {
        throw forbidden('Only the customer and technician can chat on a booking');
      }
      const { rows } = await pool.query(
        `WITH m AS (
           INSERT INTO messages (booking_id, sender_id, body) VALUES ($1, $2, $3)
           RETURNING id, body, created_at, sender_id)
         SELECT m.id, m.body, m.created_at AS "createdAt", m.sender_id AS "senderId",
                u.full_name AS "senderName"
           FROM m JOIN users u ON u.id = m.sender_id`,
        [id, user.id, body],
      );
      const message = rows[0];
      deps.realtime.toBooking(id, 'message.created', { bookingId: id, message });
      return message;
    },
  };
}
export type BookingsService = ReturnType<typeof createBookingsService>;
