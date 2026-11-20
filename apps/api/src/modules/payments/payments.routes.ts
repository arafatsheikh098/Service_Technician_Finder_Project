import { Router, type Request } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { env, mockPayEnabled } from '../../config/env.js';
import { pool, withTransaction, pgCode, PgError } from '../../db/pool.js';
import { AppError, conflict, forbidden, notFound, unauthorized } from '../../lib/errors.js';
import { hmacSha256, safeEqual } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import { parse } from '../../lib/validate.js';
import type { Deps } from '../../lib/deps.js';
import { currentUser, requireAuth, requireRole } from '../../middleware/auth.js';
import { idempotency } from '../../middleware/idempotency.js';
import { registry, errors, json, secured } from '../../docs/openapi.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

/**
 * Payment gateway integration.
 *
 * Real Bangladeshi gateways (SSLCommerz, bKash) follow the same shape as the mock
 * provider here: we create a payment, redirect the customer to the gateway's
 * checkout page, and the gateway later calls our webhook with a signed result.
 * Adding a real gateway means implementing `PaymentProvider` and its webhook
 * signature check; the rest of this module stays the same.
 */
interface PaymentProvider {
  name: string;
  createCheckout(p: { ref: string; amountBdt: number }): Promise<{ checkoutUrl: string }>;
}

const mockPay: PaymentProvider = {
  name: 'mockpay',
  async createCheckout({ ref }) {
    return { checkoutUrl: `${env.APP_URL}/mockpay/${ref}` };
  },
};

const SIGNATURE_TOLERANCE_SEC = 300;

export const CreatePaymentBody = z.object({ bookingId: z.uuid() }).meta({ id: 'CreatePayment' });
const WebhookBody = z.object({
  ref: z.string().min(8).max(100),
  status: z.enum(['succeeded', 'failed']),
});

export function signWebhook(timestamp: number, rawBody: string) {
  return hmacSha256(env.PAYMENT_WEBHOOK_SECRET, `${timestamp}.${rawBody}`);
}

export function paymentsRouter(deps: Deps) {
  const r = Router();

  async function processWebhook(raw: string, timestampHeader?: string, signatureHeader?: string) {
    const ts = Number(timestampHeader);
    if (!Number.isFinite(ts) || !signatureHeader) throw unauthorized('Missing webhook signature');
    // Reject old messages so a captured webhook can't be replayed later.
    if (Math.abs(Date.now() / 1000 - ts) > SIGNATURE_TOLERANCE_SEC)
      throw unauthorized('Stale webhook');
    if (!safeEqual(signWebhook(ts, raw), signatureHeader))
      throw unauthorized('Bad webhook signature');

    const body = parse(WebhookBody, JSON.parse(raw));

    let updated: { id: string; booking_id: string; amount_bdt: number } | undefined;
    try {
      // Only an "initiated" payment can change state, so duplicate deliveries are no-ops.
      updated = await withTransaction(async (tx) => {
        const { rows } = await tx.query<{ id: string; booking_id: string; amount_bdt: number }>(
          `UPDATE payments SET status = $2 WHERE provider_ref = $1 AND status = 'initiated'
           RETURNING id, booking_id, amount_bdt`,
          [body.ref, body.status],
        );
        return rows[0];
      });
    } catch (err) {
      if (pgCode(err) !== PgError.UNIQUE_VIOLATION) throw err;
      // The booking was already paid through another checkout. The partial unique index
      // blocked a second success; flag this one for a refund instead.
      logger.warn(
        { ref: body.ref },
        'Second successful payment for an already-paid booking; flagging for refund',
      );
      await pool.query(
        `UPDATE payments SET status = 'refunded' WHERE provider_ref = $1 AND status = 'initiated'`,
        [body.ref],
      );
      return { received: true, applied: false };
    }
    if (updated && body.status === 'succeeded') {
      const { rows } = await pool.query<{
        technician_id: string;
        customer_id: string;
        email: string;
        full_name: string;
      }>(
        `SELECT b.technician_id, b.customer_id, u.email, u.full_name
           FROM bookings b JOIN users u ON u.id = b.technician_id WHERE b.id = $1`,
        [updated.booking_id],
      );
      const b = rows[0];
      if (b) {
        const payload = { bookingId: updated.booking_id, paymentStatus: 'succeeded' };
        deps.realtime.toBooking(updated.booking_id, 'payment.updated', payload);
        deps.realtime.toUser(b.customer_id, 'payment.updated', payload);
        deps.realtime.toUser(b.technician_id, 'payment.updated', payload);
        await deps.notifier.send({
          type: 'payment_received',
          to: b.email,
          name: b.full_name,
          amountBdt: updated.amount_bdt,
          bookingUrl: `${env.APP_URL}/bookings/${updated.booking_id}`,
        });
      }
    }
    return { received: true, applied: Boolean(updated) };
  }

  r.post(
    '/',
    requireAuth,
    requireRole('customer'),
    idempotency({ required: true }),
    async (req, res) => {
      // MockPay is a sandbox. In production it is off unless explicitly enabled
      // (e.g. for a public demo) until a real gateway adapter is configured.
      if (!mockPayEnabled) {
        throw new AppError(
          503,
          'PAYMENTS_UNAVAILABLE',
          'Online payment is not available yet. Please pay the technician directly.',
        );
      }
      const user = currentUser(req);
      const { bookingId } = parse(CreatePaymentBody, req.body);
      const { rows } = await pool.query<{
        customer_id: string;
        status: string;
        quoted_price_bdt: number;
        paid: boolean;
      }>(
        `SELECT customer_id, status, quoted_price_bdt,
              EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.status = 'succeeded') AS paid
         FROM bookings b WHERE id = $1`,
        [bookingId],
      );
      const b = rows[0];
      if (!b || b.customer_id !== user.id) throw notFound('Booking');
      if (b.status !== 'completed')
        throw conflict('You can pay once the job is completed', 'NOT_COMPLETED');
      if (b.paid) throw conflict('This booking is already paid', 'ALREADY_PAID');

      const ref = `mp_${randomBytes(12).toString('hex')}`;
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO payments (booking_id, amount_bdt, provider, provider_ref) VALUES ($1, $2, $3, $4) RETURNING id`,
        [bookingId, b.quoted_price_bdt, mockPay.name, ref],
      );
      const { checkoutUrl } = await mockPay.createCheckout({ ref, amountBdt: b.quoted_price_bdt });
      res.status(201).json({
        paymentId: ins.rows[0]!.id,
        providerRef: ref,
        amountBdt: b.quoted_price_bdt,
        checkoutUrl,
      });
    },
  );

  r.get('/mockpay/:ref', requireAuth, async (req, res) => {
    if (!mockPayEnabled) throw new AppError(404, 'NOT_FOUND', 'Not available');
    const { rows } = await pool.query(
      `SELECT p.provider_ref AS ref, p.amount_bdt AS "amountBdt", p.status, p.booking_id AS "bookingId",
              b.customer_id AS "customerId"
         FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.provider_ref = $1`,
      [req.params.ref],
    );
    const p = rows[0];
    if (!p || p.customerId !== currentUser(req).id) throw notFound('Payment');
    res.json(p);
  });

  r.post('/webhooks/mockpay', async (req: Request, res) => {
    const raw = req.rawBody?.toString('utf8') ?? '';
    res.json(
      await processWebhook(
        raw,
        req.header('x-mockpay-timestamp'),
        req.header('x-mockpay-signature'),
      ),
    );
  });

  // Development stand-in for the gateway's hosted checkout page: signs a webhook
  // exactly as the gateway would and feeds it through the real webhook path.
  r.post('/mockpay/:ref/simulate', requireAuth, async (req, res) => {
    if (!mockPayEnabled) throw new AppError(404, 'NOT_FOUND', 'Not available');
    const { outcome } = parse(z.object({ outcome: z.enum(['succeeded', 'failed']) }), req.body);
    const { rows } = await pool.query<{ customer_id: string }>(
      `SELECT b.customer_id FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.provider_ref = $1`,
      [req.params.ref],
    );
    if (!rows[0]) throw notFound('Payment');
    if (rows[0].customer_id !== currentUser(req).id) throw forbidden();
    const raw = JSON.stringify({ ref: req.params.ref, status: outcome });
    const ts = Math.floor(Date.now() / 1000);
    res.json(await processWebhook(raw, String(ts), signWebhook(ts, raw)));
  });

  return r;
}

const tag = ['Payments'];
registry.registerPath({
  method: 'post',
  path: '/payments',
  tags: tag,
  security: secured,
  summary: 'Start paying for a completed booking (Idempotency-Key required)',
  request: {
    headers: z.object({ 'idempotency-key': z.string() }),
    body: { content: { 'application/json': { schema: CreatePaymentBody } } },
  },
  responses: {
    201: json(
      z.object({
        paymentId: z.uuid(),
        providerRef: z.string(),
        amountBdt: z.number(),
        checkoutUrl: z.string(),
      }),
      'Checkout created',
    ),
    409: errors[409],
  },
});
registry.registerPath({
  method: 'post',
  path: '/payments/webhooks/mockpay',
  tags: tag,
  summary: 'Gateway webhook. HMAC-SHA256 signed over "<timestamp>.<raw body>"',
  request: {
    headers: z.object({ 'x-mockpay-timestamp': z.string(), 'x-mockpay-signature': z.string() }),
    body: { content: { 'application/json': { schema: WebhookBody } } },
  },
  responses: {
    200: json(z.object({ received: z.boolean(), applied: z.boolean() })),
    401: errors[401],
  },
});
