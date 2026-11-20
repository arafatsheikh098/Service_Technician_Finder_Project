import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { api, auth, login, notifier, registerCustomer, DEMO_ACCOUNTS } from './helpers.js';

const refreshCookie = (res: { headers: Record<string, unknown> }) => {
  const cookies = (res.headers['set-cookie'] as string[] | undefined) ?? [];
  const c = cookies.find((x) => x.startsWith('tf_rt='));
  return c?.split(';')[0];
};

describe('registration and login', () => {
  it('registers a customer, sets an httpOnly refresh cookie, and returns an access token', async () => {
    const res = await api().post('/api/v1/auth/register').send({
      role: 'customer',
      fullName: 'Ayesha Akter',
      email: 'ayesha@test.dev',
      password: 'Secret123',
    });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ email: 'ayesha@test.dev', role: 'customer' });
    expect(res.body.user.password_hash).toBeUndefined();
    const cookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await api().post('/api/v1/auth/register').send({
      role: 'customer',
      fullName: 'Ayesha Again',
      email: 'AYESHA@test.dev',
      password: 'Secret123',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('never allows signing up as an admin', async () => {
    const res = await api().post('/api/v1/auth/register').send({
      role: 'admin',
      fullName: 'Mallory',
      email: 'mallory@test.dev',
      password: 'Secret123',
    });
    expect(res.status).toBe(400);
  });

  it('rejects weak passwords and invalid phone numbers', async () => {
    const res = await api().post('/api/v1/auth/register').send({
      role: 'customer',
      fullName: 'Weak',
      email: 'weak@test.dev',
      password: 'short',
      phone: '12345',
    });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['password', 'phone']));
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const a = await api()
      .post('/api/v1/auth/login')
      .send({ email: DEMO_ACCOUNTS.customer, password: 'wrong' });
    const b = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.dev', password: 'wrong' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });
});

describe('access control', () => {
  it('requires a token', async () => {
    expect((await api().get('/api/v1/users/me')).status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = jwt.sign({ role: 'admin' }, 'attacker-secret-attacker-secret-1234', {
      subject: '00000000-0000-0000-0000-000000000000',
      issuer: 'techfinder',
      audience: 'techfinder-api',
    });
    expect((await api().get('/api/v1/admin/stats').set(auth(forged))).status).toBe(401);
  });

  it('rejects the "none" algorithm', async () => {
    const unsigned = jwt.sign(
      { role: 'admin', sub: 'x', iss: 'techfinder', aud: 'techfinder-api' },
      '',
      {
        algorithm: 'none',
      },
    );
    expect((await api().get('/api/v1/admin/stats').set(auth(unsigned))).status).toBe(401);
  });

  it('forbids customers from admin routes', async () => {
    const { token } = await registerCustomer();
    expect((await api().get('/api/v1/admin/stats').set(auth(token))).status).toBe(403);
  });

  it('lets admins read platform stats', async () => {
    const token = await login(DEMO_ACCOUNTS.admin);
    const res = await api().get('/api/v1/admin/stats').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.usersByRole.technician).toBeGreaterThan(0);
  });
});

describe('refresh token rotation', () => {
  it('rotates the refresh token and revokes the whole session if an old one is replayed', async () => {
    const loginRes = await api()
      .post('/api/v1/auth/login')
      .send({ email: DEMO_ACCOUNTS.customer, password: 'Demo@12345' });
    const first = refreshCookie(loginRes)!;

    const r1 = await api().post('/api/v1/auth/refresh').set('Cookie', first);
    expect(r1.status).toBe(200);
    const second = refreshCookie(r1)!;
    expect(second).not.toBe(first);

    // An attacker replays the first (already rotated) token...
    const replay = await api().post('/api/v1/auth/refresh').set('Cookie', first);
    expect(replay.status).toBe(401);

    // ...which also kills the legitimate user's current token.
    const after = await api().post('/api/v1/auth/refresh').set('Cookie', second);
    expect(after.status).toBe(401);
  });

  it('logout revokes the session', async () => {
    const loginRes = await api()
      .post('/api/v1/auth/login')
      .send({ email: DEMO_ACCOUNTS.customer, password: 'Demo@12345' });
    const cookie = refreshCookie(loginRes)!;
    expect((await api().post('/api/v1/auth/logout').set('Cookie', cookie)).status).toBe(204);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });
});

describe('password reset', () => {
  it('emails a single-use link and signs out other sessions', async () => {
    const { email } = await registerCustomer();
    const loginRes = await api().post('/api/v1/auth/login').send({ email, password: 'Passw0rd!' });
    const oldSession = refreshCookie(loginRes)!;

    const res = await api().post('/api/v1/auth/forgot-password').send({ email });
    expect(res.status).toBe(202);
    const mail = notifier.outbox.findLast((n) => n.type === 'password_reset' && n.to === email);
    expect(mail).toBeDefined();
    const token = new URL((mail as { resetUrl: string }).resetUrl).searchParams.get('token')!;

    expect(
      (await api().post('/api/v1/auth/reset-password').send({ token, password: 'NewPass123' }))
        .status,
    ).toBe(200);
    // Single use
    expect(
      (await api().post('/api/v1/auth/reset-password').send({ token, password: 'Another123' }))
        .status,
    ).toBe(400);
    // Old sessions are gone, new password works
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', oldSession)).status).toBe(401);
    expect(
      (await api().post('/api/v1/auth/login').send({ email, password: 'NewPass123' })).status,
    ).toBe(200);
  });

  it('does not reveal whether an email is registered', async () => {
    const res = await api().post('/api/v1/auth/forgot-password').send({ email: 'ghost@test.dev' });
    expect(res.status).toBe(202);
  });
});
