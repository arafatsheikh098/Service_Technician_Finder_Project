import { Queue, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { createRedis } from './lib/redis.js';
import { NOTIFICATIONS_QUEUE, type Notification } from './jobs/notifications.js';
import { render } from './jobs/templates.js';

/**
 * Background worker process. Runs separately from the API so slow SMTP servers
 * or retries never hold up HTTP requests, and so it can be scaled on its own.
 */
const connection = createRedis('worker');

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

const notifications = new Worker<Notification>(
  NOTIFICATIONS_QUEUE,
  async (job) => {
    const { subject, html, text } = render(job.data);
    await transport.sendMail({ from: env.MAIL_FROM, to: job.data.to, subject, html, text });
    logger.info({ jobId: job.id, type: job.data.type }, 'email sent');
  },
  { connection, concurrency: 10 },
);
notifications.on('failed', (job, err) =>
  logger.warn(
    { jobId: job?.id, attempts: job?.attemptsMade, err: err.message },
    'email job failed',
  ),
);

// Housekeeping: delete expired tokens and old idempotency records every hour.
const MAINTENANCE_QUEUE = 'maintenance';
const maintenanceQueue = new Queue(MAINTENANCE_QUEUE, { connection });
await maintenanceQueue.upsertJobScheduler(
  'hourly-cleanup',
  { every: 3_600_000 },
  { name: 'cleanup' },
);

const maintenance = new Worker(
  MAINTENANCE_QUEUE,
  async () => {
    const r1 = await pool.query(
      `DELETE FROM refresh_tokens WHERE expires_at < now() - interval '1 day'`,
    );
    const r2 = await pool.query(
      `DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '1 day'`,
    );
    const r3 = await pool.query(
      `DELETE FROM idempotency_keys WHERE created_at < now() - interval '24 hours'`,
    );
    logger.info(
      { refresh: r1.rowCount, reset: r2.rowCount, idempotency: r3.rowCount },
      'cleanup done',
    );
  },
  { connection },
);

logger.info('Worker started');

async function shutdown(signal: string) {
  logger.info({ signal }, 'Worker shutting down');
  await Promise.allSettled([notifications.close(), maintenance.close(), maintenanceQueue.close()]);
  await pool.end();
  connection.disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
