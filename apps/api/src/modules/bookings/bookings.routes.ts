import { Router } from 'express';
import { z } from 'zod';
import { currentUser, requireAuth, requireRole } from '../../middleware/auth.js';
import { idempotency } from '../../middleware/idempotency.js';
import { parse } from '../../lib/validate.js';
import type { Deps } from '../../lib/deps.js';
import { registry, errors, json, secured } from '../../docs/openapi.js';
import {
  CreateBookingBody,
  ListBookingsQuery,
  TransitionBody,
  createBookingsService,
} from './bookings.service.js';

const IdParams = z.object({ id: z.uuid() });
export const ReviewBody = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional(),
  })
  .meta({ id: 'Review' });
const MessageBody = z
  .object({ body: z.string().trim().min(1).max(2000) })
  .meta({ id: 'ChatMessage' });
const MessagesQuery = z.object({ after: z.coerce.number().int().min(0).default(0) });

export function bookingsRouter(deps: Deps) {
  const service = createBookingsService(deps);
  const r = Router();
  r.use(requireAuth);

  r.post('/', requireRole('customer'), idempotency({ required: false }), async (req, res) => {
    const body = parse(CreateBookingBody, req.body);
    res.status(201).json(await service.create(currentUser(req), body));
  });

  r.get('/', async (req, res) => {
    res.json(await service.list(currentUser(req), parse(ListBookingsQuery, req.query)));
  });

  // Must be registered before "/:id".
  r.get('/summary', async (req, res) => {
    res.json(await service.summary(currentUser(req)));
  });

  r.get('/:id', async (req, res) => {
    const { id } = parse(IdParams, req.params);
    res.json(await service.getBooking(id, currentUser(req)));
  });

  r.post('/:id/transitions', async (req, res) => {
    const { id } = parse(IdParams, req.params);
    res.json(await service.transition(currentUser(req), id, parse(TransitionBody, req.body)));
  });

  r.post('/:id/review', requireRole('customer'), async (req, res) => {
    const { id } = parse(IdParams, req.params);
    res.status(201).json(await service.review(currentUser(req), id, parse(ReviewBody, req.body)));
  });

  r.get('/:id/messages', async (req, res) => {
    const { id } = parse(IdParams, req.params);
    const { after } = parse(MessagesQuery, req.query);
    res.json(await service.listMessages(currentUser(req), id, after));
  });

  r.post('/:id/messages', async (req, res) => {
    const { id } = parse(IdParams, req.params);
    const { body } = parse(MessageBody, req.body);
    res.status(201).json(await service.sendMessage(currentUser(req), id, body));
  });

  return r;
}

const tag = ['Bookings'];
const idemHeader = z.object({
  'idempotency-key': z.string().optional().describe('Unique per logical request; retries reuse it'),
});
registry.registerPath({
  method: 'post',
  path: '/bookings',
  tags: tag,
  security: secured,
  summary: 'Book a technician for a time slot (customers)',
  description:
    'Returns 409 SLOT_TAKEN if the technician already has an overlapping booking. Safe to retry with Idempotency-Key.',
  request: {
    headers: idemHeader,
    body: { content: { 'application/json': { schema: CreateBookingBody } } },
  },
  responses: {
    201: { description: 'Booking created' },
    400: errors[400],
    401: errors[401],
    409: errors[409],
  },
});
registry.registerPath({
  method: 'get',
  path: '/bookings',
  tags: tag,
  security: secured,
  summary: 'List my bookings (customers see their own, technicians their jobs, admins all)',
  request: { query: ListBookingsQuery },
  responses: { 200: { description: 'Page of bookings' }, 401: errors[401] },
});
registry.registerPath({
  method: 'get',
  path: '/bookings/{id}',
  tags: tag,
  security: secured,
  summary: 'Booking detail with timeline and the transitions I am allowed to make',
  request: { params: IdParams },
  responses: { 200: { description: 'Booking' }, 404: errors[404] },
});
registry.registerPath({
  method: 'post',
  path: '/bookings/{id}/transitions',
  tags: tag,
  security: secured,
  summary:
    'Move a booking through its lifecycle (accept, start travel, start work, complete, cancel)',
  request: {
    params: IdParams,
    body: { content: { 'application/json': { schema: TransitionBody } } },
  },
  responses: { 200: { description: 'Updated booking' }, 409: errors[409], 404: errors[404] },
});
registry.registerPath({
  method: 'post',
  path: '/bookings/{id}/review',
  tags: tag,
  security: secured,
  summary: 'Rate a completed booking (once, customer only)',
  request: { params: IdParams, body: { content: { 'application/json': { schema: ReviewBody } } } },
  responses: { 201: { description: 'Reviewed' }, 409: errors[409], 403: errors[403] },
});
registry.registerPath({
  method: 'get',
  path: '/bookings/{id}/messages',
  tags: tag,
  security: secured,
  summary: 'Chat history for a booking',
  request: { params: IdParams, query: MessagesQuery },
  responses: { 200: { description: 'Messages' }, 404: errors[404] },
});
registry.registerPath({
  method: 'post',
  path: '/bookings/{id}/messages',
  tags: tag,
  security: secured,
  summary: 'Send a chat message (also pushed over WebSocket)',
  request: { params: IdParams, body: { content: { 'application/json': { schema: MessageBody } } } },
  responses: {
    201: json(z.object({ id: z.number(), body: z.string() }), 'Sent'),
    404: errors[404],
  },
});
registry.registerPath({
  method: 'get',
  path: '/bookings/summary',
  tags: tag,
  security: secured,
  summary: 'Dashboard numbers for the current customer or technician',
  responses: {
    200: { description: 'Counts, totals, 6-month history and the next booking' },
    403: errors[403],
  },
});
