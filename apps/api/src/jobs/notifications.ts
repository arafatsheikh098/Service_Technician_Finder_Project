import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { logger } from '../lib/logger.js';

export const NOTIFICATIONS_QUEUE = 'notifications';

export type Notification =
  | { type: 'welcome'; to: string; name: string }
  | { type: 'password_reset'; to: string; name: string; resetUrl: string }
  | {
      type: 'booking_requested';
      to: string;
      technicianName: string;
      customerName: string;
      service: string;
      when: string;
      bookingUrl: string;
    }
  | {
      type: 'booking_status';
      to: string;
      name: string;
      status: string;
      service: string;
      bookingUrl: string;
    }
  | { type: 'payment_received'; to: string; name: string; amountBdt: number; bookingUrl: string };

/** Sending email must never block or fail an API request, so it goes through a queue. */
export interface Notifier {
  send(n: Notification): Promise<void>;
  close(): Promise<void>;
}

export class QueueNotifier implements Notifier {
  private readonly queue: Queue<Notification>;

  constructor(connection: Redis) {
    this.queue = new Queue<Notification>(NOTIFICATIONS_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
  }

  async send(n: Notification) {
    try {
      await this.queue.add(n.type, n);
    } catch (err) {
      // A Redis outage degrades notifications; it must not fail the user's request.
      logger.error({ err, type: n.type }, 'Failed to enqueue notification');
    }
  }

  close() {
    return this.queue.close();
  }
}

/** Logs instead of sending. Keeps the last messages in memory so tests can inspect them. */
export class LogNotifier implements Notifier {
  readonly outbox: Notification[] = [];

  async send(n: Notification) {
    this.outbox.push(n);
    if (this.outbox.length > 100) this.outbox.shift();
    logger.info({ type: n.type, to: n.to }, 'notification (log driver)');
  }

  async close() {}
}
