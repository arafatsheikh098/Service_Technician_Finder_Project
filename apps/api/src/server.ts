import { createServer } from 'node:http';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { migrate } from './db/migrator.js';
import { logger } from './lib/logger.js';
import { createRedis } from './lib/redis.js';
import { initRevocation } from './lib/revocation.js';
import { LogNotifier, QueueNotifier, type Notifier } from './jobs/notifications.js';
import { createRealtimeServer } from './realtime/socket.js';
import type { RealtimePublisher } from './realtime/events.js';
import { createApp } from './app.js';

const redis = createRedis('api');
initRevocation(redis);
const notifier: Notifier =
  env.NOTIFICATIONS_DRIVER === 'queue' ? new QueueNotifier(redis) : new LogNotifier();

await migrate(pool, (m) => logger.info(m));

// The Socket.IO server needs the HTTP server, and the app needs the publisher.
// A late-bound publisher breaks that cycle.
let publisher: RealtimePublisher = { toUser() {}, toBooking() {}, disconnectUser() {} };
const realtime: RealtimePublisher = {
  toUser: (...a) => publisher.toUser(...a),
  toBooking: (...a) => publisher.toBooking(...a),
  disconnectUser: (...a) => publisher.disconnectUser(...a),
};

const app = createApp({ notifier, realtime, redis });
const httpServer = createServer(app);
const rt = createRealtimeServer(httpServer, redis);
publisher = rt.publisher;

httpServer.listen(env.PORT, () =>
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening'),
);

// Graceful shutdown: stop accepting connections, let in-flight requests finish,
// then close pools. Containers get SIGTERM before being killed.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  await rt.io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await notifier.close();
  await pool.end();
  redis.disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled rejection'));
