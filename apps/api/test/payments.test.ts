import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { api, auth, demoTechnician, futureSlot, registerCustomer } from './helpers.js';
import { signWebhook } from '../src/modules/payments/payments.routes.js';

let tech: Awaited<ReturnType<typeof demoTechnician>>;
let customer: Awaited<ReturnType<typeof registerCustomer>>;
let bookingId: string;

async function completedBooking(hour: number) {
  const b = await api()
    .post('/api/v1/bookings')
    .set(auth(customer.token))
    .send({
      technicianId: tech.profile.id,
      category: 'plumber',
      startAt: futureSlot(8, hour),
      durationHours: 1,
      address: 'Flat 4B, Agrabad',
      lat: tech.profile.lat,
      lng: tech.profile.lng,
    });
  expect(b.status).toBe(201);
  return b.body.id as string;
}

async function complete(id: string) {
  for (const to of ['accepted', 'en_route', 'in_progress', 'completed']) {
    await api().post(`/api/v1/bookings/${id}/transitions`).set(auth(tech.token)).send({ to });
  }
}

const pay = (id: string, key = `pay-${randomUUID()}`) =>
  api()
    .post('/api/v1/payments')
    .set(auth(customer.token))
    .set('Idempotency-Key', key)
    .send({ bookingId: id });

const webhook = (body: object, ts = Math.floor(Date.now() / 1000), sig?: string) => {
  const raw = JSON.stringify(body);
  return api()
    .post('/api/v1/payments/webhooks/mockpay')
    .set('Content-Type', 'application/json')
    .set('x-mockpay-timestamp', String(ts))
    .set('x-mockpay-signature', sig ?? signWebhook(ts, raw))
    .send(raw);
};

beforeAll(async () => {
  tech = await demoTechnician();
  customer = await registerCustomer();
  bookingId = await completedBooking(6);
});

describe('payments', () => {
  it('cannot pay before the job is completed', async () => {
    const res = await pay(bookingId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_COMPLETED');
  });

  it('requires an Idempotency-Key', async () => {
    const res = await api().post('/api/v1/payments').set(auth(customer.token)).send({ bookingId });
    expect(res.status).toBe(400);
  });

  it('completes a payment through a signed webhook, exactly once', async () => {
    await complete(bookingId);
    const checkout = await pay(bookingId);
    expect(checkout.status).toBe(201);
    const ref = checkout.body.providerRef as string;

    // Forged signature
    expect((await webhook({ ref, status: 'succeeded' }, undefined, 'deadbeef')).status).toBe(401);
    // Old timestamp (replay of a captured webhook)
    expect(
      (await webhook({ ref, status: 'succeeded' }, Math.floor(Date.now() / 1000) - 3600)).status,
    ).toBe(401);

    const ok = await webhook({ ref, status: 'succeeded' });
    expect(ok.status).toBe(200);
    expect(ok.body.applied).toBe(true);

    // Gateways retry webhooks; the second delivery must be a no-op.
    const dup = await webhook({ ref, status: 'succeeded' });
    expect(dup.body.applied).toBe(false);

    const detail = await api().get(`/api/v1/bookings/${bookingId}`).set(auth(customer.token));
    expect(detail.body.paymentStatus).toBe('succeeded');

    const again = await pay(bookingId);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_PAID');
  });

  it('never records two successful payments for one booking, even with two checkouts', async () => {
    const id = await completedBooking(10);
    await complete(id);
    const a = await pay(id);
    const b = await pay(id);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect((await webhook({ ref: a.body.providerRef, status: 'succeeded' })).body.applied).toBe(
      true,
    );
    expect((await webhook({ ref: b.body.providerRef, status: 'succeeded' })).body.applied).toBe(
      false,
    );
  });
});
