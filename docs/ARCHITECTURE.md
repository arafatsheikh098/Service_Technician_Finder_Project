# Architecture & design decisions

This document explains _why_ TechFinder is built the way it is, including the trade-offs. Each section names the code and tests to read.

## 1. System overview

```
Browser ──▶ nginx ──▶ API (Express, N instances) ──▶ PostgreSQL + PostGIS
                         │   ▲
                         ▼   │ Socket.IO Redis adapter
                        Redis ◀── Worker (BullMQ: email, cleanup)
```

- **API** is stateless. Sessions live in Postgres (refresh tokens). Rate-limit counters, socket fan-out and the last known technician location live in Redis. Any instance can serve any request, so it scales horizontally behind a load balancer.
- **Worker** is a separate process. Slow SMTP servers, retries and scheduled cleanup never compete with HTTP traffic, and the worker can scale independently.
- **nginx** serves the built SPA and reverse-proxies `/api`, `/socket.io` and `/uploads` on the **same origin**. The refresh cookie stays first-party and production needs no CORS.

## 2. Data model and invariants in the database

Schema: [`apps/api/migrations/001_init.sql`](../apps/api/migrations/001_init.sql).

Rules that must never be broken are enforced by Postgres, not only by application code. Application checks have race windows; constraints don't.

| Invariant                                                                       | Mechanism                                                                                            |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A technician never has two overlapping active bookings                          | `EXCLUDE USING gist (technician_id WITH =, slot WITH &&) WHERE status IN (active…)` on a `tstzrange` |
| At most one successful payment per booking                                      | Partial unique index `ON payments (booking_id) WHERE status = 'succeeded'`                           |
| A booking is reviewed at most once, only after completion, only by its customer | `reviews.booking_id` primary key + `BEFORE INSERT` trigger                                           |
| Rating counters always match the reviews                                        | Updated by the same trigger, inside the same transaction                                             |
| Slots are sane                                                                  | `CHECK` (non-empty, start < end, ≤ 8 h)                                                              |

**Why a range exclusion constraint, not `SELECT … then INSERT`?** Two requests can both run the `SELECT`, both see a free slot, and both insert. Fixing that in the application needs `SERIALIZABLE` isolation with retries, or a lock on a technician row. The exclusion constraint makes Postgres the single arbiter. The losing insert gets SQLSTATE `23P01`, which the API maps to `409 SLOT_TAKEN`. Ranges are half-open (`[)`), so a 12:00–14:00 booking doesn't block 14:00–16:00. `bookings.test.ts › concurrency` proves this with 10 parallel requests.

**Denormalized counters** (`rating_sum`, `rating_count`, `jobs_offered/accepted/completed`) keep search to a single indexed query with no aggregation. They are only changed inside the transaction that changes their source rows.

## 3. Geo search and ranking

[`technicians.service.ts`](../apps/api/src/modules/technicians/technicians.service.ts), [`ranking.ts`](../apps/api/src/modules/technicians/ranking.ts)

1. **Candidate query (SQL).** `geography(Point, 4326)` with a GiST index, so distances are in metres on the spheroid. Filters:
   - `ST_DWithin(location, origin, radius)` uses the index
   - the customer must also be inside _the technician's_ `service_radius_km`
   - verified, available and active
   - optional category
   - optional `NOT EXISTS` overlapping active booking for the requested window

   Results are ordered by KNN `<->` and capped at 300 candidates.

2. **Ranking (TypeScript).** Each component is normalized to [0, 1]:
   - **rating**: Bayesian average `(C·m + Σratings) / (C + n)` with prior mean m = 4.0 and weight C = 5. A newcomer with one 5★ review scores about 4.17, not 5.0.
   - **proximity**: `1 − distance / radius`
   - **reliability**: Laplace-smoothed acceptance rate `(accepted + 1) / (offered + 2)`
   - **experience**: saturates at 10 years

   `score = 0.45·rating + 0.30·proximity + 0.15·reliability + 0.10·experience`

**Why rank in application code?** The formula is unit-testable and changes often, and the breakdown is returned so the UI can explain each rank. The trade-off is that pagination happens after ranking over at most 300 nearest candidates, which is fine for a city-scale marketplace. At larger scale, move the formula into SQL or a search engine.

## 4. Booking lifecycle

[`booking-state.ts`](../apps/api/src/modules/bookings/booking-state.ts)

```
pending ──accept──▶ accepted ──▶ en_route ──▶ in_progress ──▶ completed
   │ reject            │ cancel     │ cancel (admin)  │ cancel (admin)
   ▼                   ▼            ▼                 ▼
rejected            cancelled    cancelled         cancelled
```

- One table defines every legal `(from → to, roles)`. The API returns `allowedTransitions` for the current user, so the UI shows only valid buttons and holds no rules of its own.
- Transitions run in a transaction with `SELECT … FOR UPDATE` on the booking row, so two concurrent moves are serialized.
- Every transition is written to `booking_events`, an append-only audit log that the UI shows as the timeline.
- Other people's bookings return **404, not 403**, so booking IDs can't be probed.

## 5. Authentication and sessions

[`auth.service.ts`](../apps/api/src/modules/auth/auth.service.ts), [`api.ts` (client)](../apps/web/src/lib/api.ts)

| Token                                                     | Lifetime | Stored                                                                        | Why                                                                                             |
| --------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Access JWT (HS256, `iss`/`aud` checked, algorithm pinned) | 15 min   | JS memory only                                                                | Short-lived, so revocation lag is bounded; not in localStorage, so a later XSS can't harvest it |
| Refresh token (256-bit random)                            | 30 days  | `httpOnly; SameSite=Strict; Path=/api/v1/auth` cookie; **SHA-256 hash** in DB | JavaScript can't read it, it isn't sent cross-site, and a DB leak doesn't leak usable tokens    |

**Rotation with reuse detection.** Each refresh issues a new token and marks the old one rotated. All tokens from one login share a `family_id`. If a rotated token is presented again, someone has a copy, so the whole family is revoked. One subtle bug was caught by `auth.test.ts`: the first version threw an error _inside_ the transaction after revoking, which rolled the revocation back. It now commits first, then returns 401.

**Instant revocation.** JWTs are stateless, so on their own a stolen or orphaned access
token would live for up to 15 minutes. `lib/revocation.ts` records a per-user "tokens
issued at or before second T are invalid" marker in Redis (shared by all instances) on
account disable or delete, password change or reset, and refresh-token replay.
`requireAuth` and the Socket.IO handshake check it, and open sockets are closed through
the Redis adapter. A Redis outage fails open with a warning: refresh tokens are still
revoked in Postgres, so exposure stays bounded by the access-token lifetime.

The SPA de-duplicates concurrent refreshes (one in-flight promise). Otherwise two tabs refreshing at once would look like a replay.

Also included:

- bcrypt (cost 12)
- a dummy hash compare for unknown emails (constant-time login)
- identical errors for "no such user" and "wrong password"
- forgot-password always returns 202
- single-use reset tokens with a 30-minute expiry that revoke all sessions when used
- admin accounts only from seed or ops, never from signup

## 6. Idempotency

[`idempotency.ts`](../apps/api/src/middleware/idempotency.ts)

Mobile networks drop responses, and users double-tap. For `POST /bookings` (optional) and `POST /payments` (required) the client sends `Idempotency-Key`.

- First request: insert `(user_id, key, request_hash)`, run the handler, and store the status and body **before** sending the response. A retry that arrives the instant the client sees the response will find it.
- Retry with the same key and body: replay the stored response with `Idempotent-Replayed: true`.
- Same key, different body: `422`. Still running: `409`. A `5xx` deletes the key so the client can retry.
- The worker purges keys older than 24 hours.

## 7. Payments

[`payments.routes.ts`](../apps/api/src/modules/payments/payments.routes.ts)

The flow matches SSLCommerz, bKash and Stripe Checkout: create a payment, redirect to the gateway, and receive a **webhook**. The webhook is:

- authenticated with **HMAC-SHA256 over `timestamp.rawBody`**, compared in constant time
- rejected if the timestamp is more than 5 minutes off, which blocks replay of captured webhooks
- **idempotent**: `UPDATE … WHERE status = 'initiated'` makes redeliveries no-ops
- protected against double charging: if two checkouts both succeed, the partial unique index rejects the second, which is flagged `refunded`

The sandbox "MockPay" page signs a webhook the same way a gateway would and sends it through the real handler. A real gateway is one `PaymentProvider` implementation plus its signature check.

## 8. Real-time

[`socket.ts`](../apps/api/src/realtime/socket.ts)

- The handshake authenticates with the access token. Each socket joins `user:<id>`. `booking:join` checks in the database that the user is a party to the booking.
- Services publish through a `RealtimePublisher` interface, so they don't depend on Socket.IO (tests use a recording implementation).
- **Live location:** only the assigned technician, only while `en_route` or `in_progress`, throttled to one update per 2 s. The latest position is cached in Redis with a TTL, so a customer who opens the page later sees it immediately.
- The **Redis adapter** fans events out across API instances.
- Chat messages are persisted through REST (durable, paginated, authorized) and _pushed_ over the socket. The socket is never the source of truth.

## 9. AI triage

[`triage.service.ts`](../apps/api/src/modules/triage/triage.service.ts)

- Claude receives the service catalog and the customer's text, wrapped in tags and labeled as data, not instructions. **Structured output** is constrained by a Zod schema whose `categorySlug` is an enum of real slugs, so the model can't invent a category.
- Low effort keeps classification fast and cheap. Server-side refusal fallbacks are enabled.
- **The model never sets prices.** The range is the interquartile range of verified technicians' hourly rates for that category times the estimated hours. It is grounded in marketplace data.
- Auth-only, rate-limited to 10 per minute per IP. On any failure, or without an API key, a keyword matcher with English, Bangla and Banglish vocabulary takes over (`source: "keywords"`).

## 10. Operations

| Concern    | Implementation                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Config     | Zod-validated env at boot; refuses to start with missing secrets or a default webhook secret in production                           |
| Logs       | Pino JSON, request-id propagation (`X-Request-Id`), redaction of auth headers, cookies and passwords                                 |
| Metrics    | `prom-client` default metrics + `http_request_duration_seconds{method,route,status}`, labelled by route pattern to bound cardinality |
| Health     | `/health/live` (process) and `/health/ready` (DB + Redis) for orchestrator probes                                                    |
| Shutdown   | SIGTERM: close sockets, drain HTTP, close queue and pool; forced exit after 10 s                                                     |
| Migrations | Forward-only SQL files, one transaction each, `pg_advisory_lock` so simultaneously starting instances don't race                     |
| Uploads    | Memory buffer, 2 MB cap, type detected by magic bytes, random server-side filename, served with `nosniff`                            |
| Containers | Multi-stage builds, production dependencies only, non-root user, `HEALTHCHECK`                                                       |
| Load       | k6 script; findings in the README (including the nginx keep-alive fix)                                                               |

## 11. Known limitations and next steps

- Uploads go to local disk. Behind more than one instance, use S3-compatible object storage; the upload handler is the only place to change.
- Revocation is per user ("tokens issued before T are dead"), not per token; signing out one device revokes that device's refresh family, and its 15-minute access token expires on its own.
- Search ranks a bounded candidate set in memory. Fine per city; a national scale would push ranking into SQL or a search engine.
- No end-to-end browser tests in CI yet (Playwright is on the roadmap).
