import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  api,
  auth,
  demoTechnician,
  futureSlot,
  login,
  registerCustomer,
  DEMO_ACCOUNTS,
} from './helpers.js';

const refreshCookie = (res: { headers: Record<string, unknown> }) =>
  ((res.headers['set-cookie'] as string[] | undefined) ?? [])
    .find((c) => c.startsWith('tf_rt='))
    ?.split(';')[0];

async function loginWithCookie(email: string, password: string) {
  const res = await api().post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return {
    token: res.body.accessToken as string,
    cookie: refreshCookie(res)!,
    user: res.body.user,
  };
}

describe('session revocation', () => {
  it('kills access tokens and refresh tokens the moment an admin disables an account', async () => {
    const { email } = await registerCustomer();
    const s = await loginWithCookie(email, 'Passw0rd!');
    expect((await api().get('/api/v1/users/me').set(auth(s.token))).status).toBe(200);

    const admin = await login(DEMO_ACCOUNTS.admin);
    expect(
      (
        await api()
          .post(`/api/v1/admin/users/${s.user.id}/status`)
          .set(auth(admin))
          .send({ active: false })
      ).status,
    ).toBe(200);

    expect((await api().get('/api/v1/users/me').set(auth(s.token))).status).toBe(401);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', s.cookie)).status).toBe(401);
    expect(
      (await api().post('/api/v1/auth/login').send({ email, password: 'Passw0rd!' })).status,
    ).toBe(403);
  });

  it('changing the password signs out other sessions but keeps this one', async () => {
    const { email } = await registerCustomer();
    const here = await loginWithCookie(email, 'Passw0rd!');
    const elsewhere = await loginWithCookie(email, 'Passw0rd!');

    const wrong = await api()
      .post('/api/v1/users/me/password')
      .set(auth(here.token))
      .set('Cookie', here.cookie)
      .send({ currentPassword: 'nope', newPassword: 'NewPassw0rd' });
    expect(wrong.status).toBe(400);

    await new Promise((r) => setTimeout(r, 1100)); // revocation has 1-second granularity
    const ok = await api()
      .post('/api/v1/users/me/password')
      .set(auth(here.token))
      .set('Cookie', here.cookie)
      .send({ currentPassword: 'Passw0rd!', newPassword: 'NewPassw0rd' });
    expect(ok.status).toBe(200);

    // The other device is fully signed out.
    expect((await api().get('/api/v1/users/me').set(auth(elsewhere.token))).status).toBe(401);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', elsewhere.cookie)).status).toBe(
      401,
    );
    // This device continues with the fresh token and its own refresh cookie.
    expect((await api().get('/api/v1/users/me').set(auth(ok.body.accessToken))).status).toBe(200);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', here.cookie)).status).toBe(200);
  });
});

describe('account deletion', () => {
  it('requires the password, anonymises the user, cancels open bookings and ends every session', async () => {
    const tech = await demoTechnician();
    const c = await registerCustomer();
    const s = await loginWithCookie(c.email, 'Passw0rd!');
    const b = await api()
      .post('/api/v1/bookings')
      .set(auth(s.token))
      .send({
        technicianId: tech.profile.id,
        category: 'plumber',
        startAt: futureSlot(10, 6),
        durationHours: 1,
        address: 'House 1, Agrabad',
        lat: tech.profile.lat,
        lng: tech.profile.lng,
      });
    expect(b.status).toBe(201);

    expect(
      (await api().delete('/api/v1/users/me').set(auth(s.token)).send({ password: 'Passw0rd!' }))
        .status,
    ).toBe(400);
    expect(
      (
        await api()
          .delete('/api/v1/users/me')
          .set(auth(s.token))
          .send({ password: 'wrong', confirm: 'DELETE' })
      ).status,
    ).toBe(400);

    const del = await api()
      .delete('/api/v1/users/me')
      .set(auth(s.token))
      .send({ password: 'Passw0rd!', confirm: 'DELETE' });
    expect(del.status).toBe(204);

    expect((await api().get('/api/v1/users/me').set(auth(s.token))).status).toBe(401);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', s.cookie)).status).toBe(401);
    expect(
      (await api().post('/api/v1/auth/login').send({ email: c.email, password: 'Passw0rd!' }))
        .status,
    ).toBe(401);

    const seenByTech = await api().get(`/api/v1/bookings/${b.body.id}`).set(auth(tech.token));
    expect(seenByTech.body.status).toBe('cancelled');
    expect(seenByTech.body.customer.fullName).toBe('Deleted user');
    expect(seenByTech.body.customer.phone).toBeNull();
  });

  it('cannot be used on admin accounts', async () => {
    const admin = await login(DEMO_ACCOUNTS.admin);
    expect(
      (
        await api()
          .delete('/api/v1/users/me')
          .set(auth(admin))
          .send({ password: 'Demo@12345', confirm: 'DELETE' })
      ).status,
    ).toBe(403);
  });
});

describe('privacy', () => {
  it('does not reveal phone numbers until the technician accepts', async () => {
    const tech = await demoTechnician();
    const c = await registerCustomer();
    await api().patch('/api/v1/users/me').set(auth(c.token)).send({ phone: '01712345678' });
    const b = await api()
      .post('/api/v1/bookings')
      .set(auth(c.token))
      .send({
        technicianId: tech.profile.id,
        category: 'electrician',
        startAt: futureSlot(10, 10),
        durationHours: 1,
        address: 'House 2, Agrabad',
        lat: tech.profile.lat,
        lng: tech.profile.lng,
      });
    expect(b.body.technician.phone).toBeNull();
    const asTech = await api().get(`/api/v1/bookings/${b.body.id}`).set(auth(tech.token));
    expect(asTech.body.customer.phone).toBeNull();

    const accepted = await api()
      .post(`/api/v1/bookings/${b.body.id}/transitions`)
      .set(auth(tech.token))
      .send({ to: 'accepted' });
    expect(accepted.body.customer.phone).toBe('01712345678');
    const asCustomer = await api().get(`/api/v1/bookings/${b.body.id}`).set(auth(c.token));
    expect(asCustomer.body.technician.phone).toMatch(/^01/);
  });

  it('shows only first name and last initial on public reviews', async () => {
    const tech = await demoTechnician();
    const profile = await api().get(`/api/v1/technicians/${tech.profile.id}`);
    for (const r of profile.body.recentReviews) {
      expect(r.customerName).toMatch(/^\S+( \S\.)?$/);
    }
  });
});

describe('abuse limits', () => {
  it('caps the number of open bookings per customer', async () => {
    const tech = await demoTechnician();
    const c = await registerCustomer();
    const book = (hour: number) =>
      api()
        .post('/api/v1/bookings')
        .set(auth(c.token))
        .send({
          technicianId: tech.profile.id,
          category: 'plumber',
          startAt: futureSlot(11, hour),
          durationHours: 1,
          address: 'House 3, Agrabad',
          lat: tech.profile.lat,
          lng: tech.profile.lng,
        });
    for (let h = 0; h < 10; h++) expect((await book(h * 2)).status).toBe(201);
    const eleventh = await book(21);
    expect(eleventh.status).toBe(409);
    expect(eleventh.body.error.code).toBe('TOO_MANY_ACTIVE_BOOKINGS');
  });

  it('rejects passwords longer than bcrypt can use (72 bytes, not characters)', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({
        role: 'customer',
        fullName: 'Long Pass',
        email: 'longpass@test.dev',
        password: `${'পাসওয়ার্ড'.repeat(4)}a1`, // ~40 characters but > 72 bytes
      });
    expect(res.status).toBe(400);
  });
});

describe('avatar uploads', () => {
  it('re-encodes images to WebP and strips metadata such as GPS', async () => {
    const c = await registerCustomer();
    const withExif = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#0b8a75' },
    })
      .jpeg()
      .withExif({
        IFD0: { Copyright: 'home-location-secret', ImageDescription: 'GPS 22.33,91.81' },
      })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const res = await api()
      .post('/api/v1/users/me/avatar')
      .set(auth(c.token))
      .attach('avatar', withExif, 'me.jpg');
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toMatch(/\.webp$/);

    const stored = await readFile(
      path.resolve(process.env.UPLOAD_DIR!, 'avatars', path.basename(res.body.avatarUrl)),
    );
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    expect(meta.width).toBeLessThanOrEqual(512);
  });

  it('rejects files that only pretend to be images', async () => {
    const c = await registerCustomer();
    const fake = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from('<script>alert(1)</script>'),
    ]);
    const res = await api()
      .post('/api/v1/users/me/avatar')
      .set(auth(c.token))
      .attach('avatar', fake, 'x.jpg');
    expect(res.status).toBe(400);
  });
});

describe('production configuration guard', () => {
  it('refuses to start with placeholder secrets', () => {
    const run = spawnSync(
      process.execPath,
      ['--import', 'tsx', '-e', "await import('./src/config/env.ts')"],
      {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'replace-me-with-a-long-random-string-at-least-32-chars',
          PAYMENT_WEBHOOK_SECRET: 'a-real-looking-webhook-secret-123',
          RATE_LIMIT_DISABLED: 'false',
        },
        encoding: 'utf8',
      },
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('JWT_ACCESS_SECRET is a placeholder');
  });
});
