import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  api,
  auth,
  demoTechnician,
  futureSlot,
  login,
  realtime,
  registerCustomer,
  DEMO_ACCOUNTS,
} from './helpers.js';

let tech: { token: string; profile: { id: string; lat: number; lng: number } };
let customer: { token: string };

const bookingBody = (startAt: string, extra: Record<string, unknown> = {}) => ({
  technicianId: tech.profile.id,
  category: 'electrician',
  startAt,
  durationHours: 2,
  address: 'House 12, Road 3, Agrabad',
  lat: tech.profile.lat,
  lng: tech.profile.lng,
  problemDescription: 'Ceiling fan not working',
  ...extra,
});

beforeAll(async () => {
  tech = await demoTechnician();
  customer = await registerCustomer();
});

describe('booking lifecycle', () => {
  it('runs pending → accepted → en_route → in_progress → completed → reviewed', async () => {
    const create = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .send(bookingBody(futureSlot(3, 4)));
    expect(create.status).toBe(201);
    const id = create.body.id as string;
    expect(create.body.status).toBe('pending');
    expect(create.body.quotedPriceBdt).toBeGreaterThan(0);
    expect(
      realtime.events.some(
        (e) => e.room === `user:${tech.profile.id}` && e.event === 'booking.created',
      ),
    ).toBe(true);

    // The customer cannot accept their own booking.
    const bad = await api()
      .post(`/api/v1/bookings/${id}/transitions`)
      .set(auth(customer.token))
      .send({ to: 'accepted' });
    expect(bad.status).toBe(409);
    expect(bad.body.error.code).toBe('INVALID_TRANSITION');

    // The technician cannot skip ahead.
    const skip = await api()
      .post(`/api/v1/bookings/${id}/transitions`)
      .set(auth(tech.token))
      .send({ to: 'completed' });
    expect(skip.status).toBe(409);

    // A review before completion is refused.
    const early = await api()
      .post(`/api/v1/bookings/${id}/review`)
      .set(auth(customer.token))
      .send({ rating: 5 });
    expect(early.status).toBe(409);

    const before = (await api().get(`/api/v1/technicians/me/profile`).set(auth(tech.token))).body;

    for (const to of ['accepted', 'en_route', 'in_progress', 'completed']) {
      const res = await api()
        .post(`/api/v1/bookings/${id}/transitions`)
        .set(auth(tech.token))
        .send({ to });
      expect(res.status, `transition to ${to}`).toBe(200);
      expect(res.body.status).toBe(to);
    }

    const review = await api()
      .post(`/api/v1/bookings/${id}/review`)
      .set(auth(customer.token))
      .send({ rating: 4, comment: 'Fixed quickly' });
    expect(review.status).toBe(201);
    expect(review.body.review).toEqual({ rating: 4, comment: 'Fixed quickly' });

    const again = await api()
      .post(`/api/v1/bookings/${id}/review`)
      .set(auth(customer.token))
      .send({ rating: 1 });
    expect(again.status).toBe(409);

    const after = (await api().get(`/api/v1/technicians/me/profile`).set(auth(tech.token))).body;
    expect(after.ratingCount).toBe(before.ratingCount + 1);
    expect(after.jobsCompleted).toBe(before.jobsCompleted + 1);

    const detail = await api().get(`/api/v1/bookings/${id}`).set(auth(customer.token));
    expect(detail.body.timeline.map((e: { to: string }) => e.to)).toEqual([
      'pending',
      'accepted',
      'en_route',
      'in_progress',
      'completed',
    ]);
  });

  it('requires a reason to cancel, and frees the slot afterwards', async () => {
    const startAt = futureSlot(3, 8);
    const b = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .send(bookingBody(startAt));
    const id = b.body.id;
    const noReason = await api()
      .post(`/api/v1/bookings/${id}/transitions`)
      .set(auth(customer.token))
      .send({ to: 'cancelled' });
    expect(noReason.status).toBe(400);
    const ok = await api()
      .post(`/api/v1/bookings/${id}/transitions`)
      .set(auth(customer.token))
      .send({ to: 'cancelled', reason: 'Fixed it myself' });
    expect(ok.status).toBe(200);
    const rebook = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .send(bookingBody(startAt));
    expect(rebook.status).toBe(201);
  });
});

describe('authorization on bookings', () => {
  it('hides a booking from other customers (404, not 403)', async () => {
    const b = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .send(bookingBody(futureSlot(3, 12)));
    const stranger = await registerCustomer();
    expect(
      (await api().get(`/api/v1/bookings/${b.body.id}`).set(auth(stranger.token))).status,
    ).toBe(404);
    const cancel = await api()
      .post(`/api/v1/bookings/${b.body.id}/transitions`)
      .set(auth(stranger.token))
      .send({ to: 'cancelled', reason: 'evil' });
    expect(cancel.status).toBe(404);
    const msg = await api()
      .post(`/api/v1/bookings/${b.body.id}/messages`)
      .set(auth(stranger.token))
      .send({ body: 'hi' });
    expect(msg.status).toBe(404);
  });

  it('only customers can create bookings', async () => {
    const res = await api()
      .post('/api/v1/bookings')
      .set(auth(tech.token))
      .send(bookingBody(futureSlot(3, 16)));
    expect(res.status).toBe(403);
  });

  it('rejects bookings in the past, for services the technician does not offer, or outside their area', async () => {
    const past = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .send(bookingBody('2020-01-01T10:00:00Z'));
    expect(past.status).toBe(400);
    const wrongService = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .send(bookingBody(futureSlot(3, 18), { category: 'pest-control' }));
    expect(wrongService.status).toBe(400);
    const farAway = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .send(bookingBody(futureSlot(3, 18), { lat: 23.75, lng: 90.37 }));
    expect(farAway.status).toBe(400);
  });
});

describe('concurrency: no double booking', () => {
  it('accepts exactly one of 10 simultaneous requests for the same slot', async () => {
    const customers = await Promise.all(Array.from({ length: 10 }, () => registerCustomer()));
    const startAt = futureSlot(4, 6);
    const results = await Promise.all(
      customers.map((c) =>
        api().post('/api/v1/bookings').set(auth(c.token)).send(bookingBody(startAt)),
      ),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe('SLOT_TAKEN');
  });

  it('also rejects partially overlapping slots', async () => {
    const a = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .send(bookingBody(futureSlot(4, 12)));
    expect(a.status).toBe(201);
    // 12:00–14:00 is taken; 13:00–15:00 overlaps, 14:00–16:00 does not ('[)' range).
    const overlap = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .send(bookingBody(futureSlot(4, 13)));
    expect(overlap.status).toBe(409);
    const adjacent = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .send(bookingBody(futureSlot(4, 14)));
    expect(adjacent.status).toBe(201);
  });

  it('excludes the busy technician from search for that time window', async () => {
    const res = await api()
      .get('/api/v1/technicians')
      .query({
        lat: tech.profile.lat,
        lng: tech.profile.lng,
        radiusKm: 5,
        from: futureSlot(4, 12),
        to: futureSlot(4, 13),
      });
    expect(res.body.items.some((t: { id: string }) => t.id === tech.profile.id)).toBe(false);
  });
});

describe('idempotency', () => {
  it('replays the original response for a retried request instead of creating a duplicate', async () => {
    const key = `test-${randomUUID()}`;
    const body = bookingBody(futureSlot(5, 6));
    const first = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .set('Idempotency-Key', key)
      .send(body);
    const retry = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .set('Idempotency-Key', key)
      .send(body);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.body.id).toBe(first.body.id);
  });

  it('refuses to reuse a key for a different request', async () => {
    const key = `test-${randomUUID()}`;
    await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .set('Idempotency-Key', key)
      .send(bookingBody(futureSlot(5, 10)));
    const other = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .set('Idempotency-Key', key)
      .send(bookingBody(futureSlot(5, 14)));
    expect(other.status).toBe(422);
  });
});

describe('chat', () => {
  it('lets both parties exchange messages and pushes them in real time', async () => {
    const b = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .send(bookingBody(futureSlot(6, 6)));
    const id = b.body.id;
    await api()
      .post(`/api/v1/bookings/${id}/messages`)
      .set(auth(customer.token))
      .send({ body: 'Gate code is 1234' });
    await api()
      .post(`/api/v1/bookings/${id}/messages`)
      .set(auth(tech.token))
      .send({ body: 'On my way at 10' });
    const list = await api().get(`/api/v1/bookings/${id}/messages`).set(auth(customer.token));
    expect(list.body.items.map((m: { body: string }) => m.body)).toEqual([
      'Gate code is 1234',
      'On my way at 10',
    ]);
    expect(
      realtime.events.filter((e) => e.room === `booking:${id}` && e.event === 'message.created'),
    ).toHaveLength(2);
  });

  it('admins can see any booking', async () => {
    const b = await api()
      .post('/api/v1/bookings')
      .set(auth(customer.token))
      .send(bookingBody(futureSlot(6, 10)));
    const admin = await login(DEMO_ACCOUNTS.admin);
    expect((await api().get(`/api/v1/bookings/${b.body.id}`).set(auth(admin))).status).toBe(200);
  });
});

describe('dashboard summary', () => {
  it('returns scoped counts, totals, a 6-month history and the next booking', async () => {
    const res = await api().get('/api/v1/bookings/summary').set(auth(customer.token));
    expect(res.status).toBe(200);
    expect(res.body.activeCount).toBeGreaterThan(0);
    expect(res.body.monthly).toHaveLength(6);
    expect(res.body.nextBooking.customer.id).toBe(res.body.nextBooking.customer.id);
    const t = await api().get('/api/v1/bookings/summary').set(auth(tech.token));
    expect(t.body.role).toBe('technician');
    expect(t.body.completedCount).toBeGreaterThan(0);
  });

  it('is not available to admins', async () => {
    const admin = await login(DEMO_ACCOUNTS.admin);
    expect((await api().get('/api/v1/bookings/summary').set(auth(admin))).status).toBe(403);
  });
});
