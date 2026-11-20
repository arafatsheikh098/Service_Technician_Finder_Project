import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { api, auth, login, registerCustomer, DEMO_ACCOUNTS } from './helpers.js';

const AGRABAD = { lat: 22.3253, lng: 91.8124 };

describe('technician search', () => {
  it('returns verified technicians in range, ranked by score, with a breakdown', async () => {
    const res = await api()
      .get('/api/v1/technicians')
      .query({ ...AGRABAD, radiusKm: 15 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const scores = res.body.items.map((t: { rank: { score: number } }) => t.rank.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    for (const t of res.body.items) expect(t.distanceKm).toBeLessThanOrEqual(15);
  });

  it('filters by category', async () => {
    const res = await api()
      .get('/api/v1/technicians')
      .query({ ...AGRABAD, radiusKm: 20, category: 'plumber' });
    for (const t of res.body.items) expect(t.categories).toContain('plumber');
  });

  it('returns nothing for a point far from any technician', async () => {
    const res = await api()
      .get('/api/v1/technicians')
      .query({ lat: 24.9, lng: 91.87, radiusKm: 10 });
    expect(res.body.total).toBe(0);
  });

  it('sorts by distance on request', async () => {
    const res = await api()
      .get('/api/v1/technicians')
      .query({ ...AGRABAD, radiusKm: 15, sort: 'distance' });
    const d = res.body.items.map((t: { distanceKm: number }) => t.distanceKm);
    expect(d).toEqual([...d].sort((a, b) => a - b));
  });

  it('validates coordinates and time windows', async () => {
    expect((await api().get('/api/v1/technicians').query({ lat: 200, lng: 0 })).status).toBe(400);
    const res = await api()
      .get('/api/v1/technicians')
      .query({ ...AGRABAD, from: '2030-01-01T10:00:00Z' });
    expect(res.status).toBe(400);
  });
});

describe('technician onboarding and verification', () => {
  it('hides a new technician from search until an admin verifies them', async () => {
    const email = `t-${randomUUID().slice(0, 8)}@test.dev`;
    const reg = await api()
      .post('/api/v1/auth/register')
      .send({
        role: 'technician',
        fullName: 'New Technician',
        email,
        password: 'Passw0rd!',
        phone: '01812345678',
        profile: {
          experienceYears: 3,
          hourlyRateBdt: 400,
          lat: 22.3,
          lng: 91.75,
          serviceRadiusKm: 5,
          categoryIds: [1],
        },
      });
    expect(reg.status).toBe(201);
    const id = reg.body.user.id as string;

    const isListed = async () => {
      const res = await api()
        .get('/api/v1/technicians')
        .query({ lat: 22.3, lng: 91.75, radiusKm: 5 });
      return res.body.items.some((t: { id: string }) => t.id === id);
    };
    expect(await isListed()).toBe(false);
    expect((await api().get(`/api/v1/technicians/${id}`)).status).toBe(404);

    const { token: customerToken } = await registerCustomer();
    const denied = await api()
      .post(`/api/v1/admin/technicians/${id}/verification`)
      .set(auth(customerToken))
      .send({ verified: true });
    expect(denied.status).toBe(403);

    const adminToken = await login(DEMO_ACCOUNTS.admin);
    const ok = await api()
      .post(`/api/v1/admin/technicians/${id}/verification`)
      .set(auth(adminToken))
      .send({ verified: true });
    expect(ok.status).toBe(200);
    expect(await isListed()).toBe(true);
  });

  it('rejects an unknown service category at signup', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({
        role: 'technician',
        fullName: 'Bad Cat',
        email: `bc-${randomUUID().slice(0, 6)}@test.dev`,
        password: 'Passw0rd!',
        phone: '01812345678',
        profile: {
          experienceYears: 1,
          hourlyRateBdt: 400,
          lat: 22.3,
          lng: 91.75,
          categoryIds: [9999],
        },
      });
    expect(res.status).toBe(400);
  });

  it('lets a technician toggle availability, which hides them from search', async () => {
    const token = await login(DEMO_ACCOUNTS.technician);
    const me = (await api().get('/api/v1/technicians/me/profile').set(auth(token))).body;
    const listed = async () =>
      (
        await api().get('/api/v1/technicians').query({ lat: me.lat, lng: me.lng, radiusKm: 5 })
      ).body.items.some((t: { id: string }) => t.id === me.id);
    expect(await listed()).toBe(true);
    await api()
      .patch('/api/v1/technicians/me/profile')
      .set(auth(token))
      .send({ isAvailable: false });
    expect(await listed()).toBe(false);
    await api()
      .patch('/api/v1/technicians/me/profile')
      .set(auth(token))
      .send({ isAvailable: true });
    expect(await listed()).toBe(true);
  });
});

describe('public stats', () => {
  it('returns aggregate numbers for the landing page', async () => {
    const res = await api().get('/api/v1/stats');
    expect(res.status).toBe(200);
    expect(res.body.verifiedTechnicians).toBeGreaterThan(0);
    expect(res.body.averageRating).toBeGreaterThanOrEqual(1);
    expect(res.body.averageRating).toBeLessThanOrEqual(5);
  });
});

describe('recent reviews', () => {
  it('returns positive written reviews with shortened names only', async () => {
    const res = await api().get('/api/v1/reviews/recent');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const r of res.body.items) {
      expect(r.rating).toBeGreaterThanOrEqual(4);
      expect(r.customerName).toMatch(/^\S+( \S\.)?$/);
      expect(r).not.toHaveProperty('email');
    }
  });
});
