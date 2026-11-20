import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/** Create a new Redis connection. BullMQ requires maxRetriesPerRequest = null. */
export function createRedis(name: string): Redis {
  const client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false });
  client.on('error', (err) => logger.warn({ err, name }, 'Redis connection error'));
  return client;
}
