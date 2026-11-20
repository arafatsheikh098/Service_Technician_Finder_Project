import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, registerCustomer } from './helpers.js';

// ANTHROPIC_API_KEY is empty in tests, so this exercises the offline keyword fallback.
let token: string;
beforeAll(async () => {
  token = (await registerCustomer()).token;
});

const triage = (description: string) =>
  api().post('/api/v1/triage').set(auth(token)).send({ description });

describe('problem triage (keyword fallback)', () => {
  it('maps an English description to a category with a data-driven price range', async () => {
    const res = await triage('The kitchen tap is leaking and the drain is blocked');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('keywords');
    expect(res.body.category.slug).toBe('plumber');
    expect(res.body.priceRangeBdt.min).toBeLessThanOrEqual(res.body.priceRangeBdt.max);
  });

  it('understands Bangla', async () => {
    const res = await triage('ঘরের ফ্যান ঘুরছে না, সুইচ কাজ করছে না');
    expect(res.body.category.slug).toBe('electrician');
  });

  it('flags hazards as emergencies with safety advice', async () => {
    const res = await triage('I can smell gas near the stove');
    expect(res.body.urgency).toBe('emergency');
    expect(res.body.safetyAdvice).toBeTruthy();
  });

  it('does not match "ac" inside other words', async () => {
    const res = await triage('My washing machine makes a noise');
    expect(res.body.category.slug).toBe('appliance-repair');
  });

  it('requires login', async () => {
    expect((await api().post('/api/v1/triage').send({ description: 'leaking pipe' })).status).toBe(
      401,
    );
  });
});
