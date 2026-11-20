import type { Redis } from 'ioredis';
import type { Notifier } from '../jobs/notifications.js';
import type { RealtimePublisher } from '../realtime/events.js';

/** Dependencies wired at startup and passed to route factories. */
export interface Deps {
  notifier: Notifier;
  realtime: RealtimePublisher;
  redis?: Redis;
}
