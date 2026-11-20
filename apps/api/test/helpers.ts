import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { LogNotifier } from '../src/jobs/notifications.js';
import { RecordingPublisher } from '../src/realtime/events.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../src/db/seed.js';

export const notifier = new LogNotifier();
export const realtime = new RecordingPublisher();
export const app = createApp({ notifier, realtime });
export const api = () => request(app);
export { DEMO_ACCOUNTS, DEMO_PASSWORD };

export async function login(email: string, password = DEMO_PASSWORD) {
  const res = await api().post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200)
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken as string;
}

export async function registerCustomer() {
  const email = `c-${randomUUID().slice(0, 8)}@test.dev`;
  const res = await api()
    .post('/api/v1/auth/register')
    .send({ role: 'customer', fullName: 'Test Customer', email, password: 'Passw0rd!' });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { email, token: res.body.accessToken as string, user: res.body.user };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A future time slot, hour-aligned, in a range reserved for one test file. */
export function futureSlot(dayOffset: number, hour: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

export async function demoTechnician() {
  const token = await login(DEMO_ACCOUNTS.technician);
  const res = await api().get('/api/v1/technicians/me/profile').set(auth(token));
  return { token, profile: res.body as { id: string; lat: number; lng: number } };
}
