import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { parse } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { registry, errors, json, secured } from '../../docs/openapi.js';
import { URGENCY, triage } from './triage.service.js';

const TriageBody = z
  .object({ description: z.string().trim().min(5).max(1000) })
  .meta({ id: 'TriageRequest' });

const TriageResponse = z
  .object({
    category: z.object({ slug: z.string(), name: z.string() }).nullable(),
    urgency: z.enum(URGENCY),
    summary: z.string(),
    safetyAdvice: z.string().nullable(),
    estimatedHours: z.number(),
    priceRangeBdt: z.object({ min: z.number(), max: z.number() }).nullable(),
    confidence: z.number(),
    source: z.enum(['ai', 'keywords']),
  })
  .meta({ id: 'TriageResult' });

export function triageRouter(aiLimiter: RequestHandler) {
  const r = Router();
  // Auth + a tight rate limit: every call costs money.
  r.post('/', requireAuth, aiLimiter, async (req, res) => {
    const { description } = parse(TriageBody, req.body);
    res.json(await triage(description));
  });
  return r;
}

registry.registerPath({
  method: 'post',
  path: '/triage',
  tags: ['AI'],
  security: secured,
  summary:
    'Describe a problem in Bangla or English; get the right service, urgency and a price range',
  request: { body: { content: { 'application/json': { schema: TriageBody } } } },
  responses: { 200: json(TriageResponse), 400: errors[400], 401: errors[401] },
});
