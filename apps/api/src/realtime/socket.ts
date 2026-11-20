import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { verifyAccessToken, type AuthUser } from '../lib/tokens.js';
import { isRevoked } from '../lib/revocation.js';
import type { RealtimePublisher } from './events.js';

const LOCATION_TTL_SEC = 2 * 3600;
const LOCATION_MIN_INTERVAL_MS = 2_000;

const JoinPayload = z.object({ bookingId: z.uuid() });
const LocationPayload = z.object({
  bookingId: z.uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
});

type Ack = (res: { ok: boolean; error?: string; [k: string]: unknown }) => void;
interface SocketData {
  user: AuthUser;
  lastLocationAt?: number;
}

/**
 * Socket.IO server for live booking updates, chat delivery and technician
 * location tracking. With the Redis adapter, events published on one API
 * instance reach clients connected to any other instance, so the API can be
 * scaled horizontally behind a load balancer.
 */
export function createRealtimeServer(httpServer: HttpServer, redis?: Redis) {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    path: '/socket.io',
  });

  if (redis) {
    io.adapter(createAdapter(redis.duplicate(), redis.duplicate()));
  }

  io.use(async (socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown })?.token;
    const verified = typeof token === 'string' ? verifyAccessToken(token) : null;
    if (!verified || (await isRevoked(verified.id, verified.iat)))
      return next(new Error('unauthorized'));
    (socket.data as SocketData).user = { id: verified.id, role: verified.role };
    next();
  });

  async function bookingFor(bookingId: string, user: AuthUser) {
    const { rows } = await pool.query<{
      customer_id: string;
      technician_id: string;
      status: string;
    }>('SELECT customer_id, technician_id, status FROM bookings WHERE id = $1', [bookingId]);
    const b = rows[0];
    if (!b) return null;
    if (user.role !== 'admin' && b.customer_id !== user.id && b.technician_id !== user.id)
      return null;
    return b;
  }

  io.on('connection', (socket: Socket) => {
    const user = (socket.data as SocketData).user;
    void socket.join(`user:${user.id}`);

    socket.on('booking:join', async (payload: unknown, ack?: Ack) => {
      const parsed = JoinPayload.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: 'invalid payload' });
      const booking = await bookingFor(parsed.data.bookingId, user).catch(() => null);
      if (!booking) return ack?.({ ok: false, error: 'not found' });
      await socket.join(`booking:${parsed.data.bookingId}`);
      const last = redis ? await redis.get(`loc:${parsed.data.bookingId}`).catch(() => null) : null;
      ack?.({ ok: true, lastLocation: last ? JSON.parse(last) : null });
    });

    socket.on('booking:leave', (payload: unknown) => {
      const parsed = JoinPayload.safeParse(payload);
      if (parsed.success) void socket.leave(`booking:${parsed.data.bookingId}`);
    });

    socket.on('location:update', async (payload: unknown, ack?: Ack) => {
      const data = socket.data as SocketData;
      const now = Date.now();
      if (data.lastLocationAt && now - data.lastLocationAt < LOCATION_MIN_INTERVAL_MS) {
        return ack?.({ ok: false, error: 'too frequent' });
      }
      const parsed = LocationPayload.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: 'invalid payload' });
      const booking = await bookingFor(parsed.data.bookingId, user).catch(() => null);
      // Only the assigned technician, and only while they are on the way or on site.
      if (
        !booking ||
        booking.technician_id !== user.id ||
        !['en_route', 'in_progress'].includes(booking.status)
      ) {
        return ack?.({ ok: false, error: 'not allowed' });
      }
      data.lastLocationAt = now;
      const location = { ...parsed.data, at: new Date(now).toISOString() };
      if (redis) {
        await redis
          .set(`loc:${parsed.data.bookingId}`, JSON.stringify(location), 'EX', LOCATION_TTL_SEC)
          .catch(() => {});
      }
      io.to(`booking:${parsed.data.bookingId}`).emit('location.updated', location);
      ack?.({ ok: true });
    });
  });

  const publisher: RealtimePublisher = {
    toUser: (userId, event, payload) => {
      io.to(`user:${userId}`).emit(event, payload);
    },
    toBooking: (bookingId, event, payload) => {
      io.to(`booking:${bookingId}`).emit(event, payload);
    },
    disconnectUser: (userId) => {
      // Works across instances through the Redis adapter.
      io.in(`user:${userId}`).disconnectSockets(true);
    },
  };

  logger.info({ redisAdapter: Boolean(redis) }, 'Realtime server ready');
  return { io, publisher };
}
