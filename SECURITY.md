# Security

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private
[security advisory](../../security/advisories/new) form for this repository, with steps
to reproduce and the impact. You will get an acknowledgement within 72 hours.

## Security controls

Every control below has an automated test (`apps/api/test/`, mainly `security.test.ts`,
`auth.test.ts` and `bookings.test.ts`).

### Authentication & sessions

- Passwords hashed with **bcrypt** (cost 12). Length is checked in **bytes** (bcrypt ignores input past 72 bytes; Bangla characters are 3 bytes each).
- **15-minute access JWTs** (HS256, issuer, audience and algorithm pinned; `alg: none` rejected) kept only in browser memory.
- **Rotating refresh tokens** in an `httpOnly; Secure; SameSite=Strict` cookie scoped to `/api/v1/auth`, stored as SHA-256 hashes. **Replaying a rotated token revokes the whole session family.**
- **Immediate revocation:** disabling or deleting an account, changing or resetting a password, or a detected token replay invalidates live access tokens at once (Redis-backed check in `requireAuth` and the WebSocket handshake) and closes open sockets.
- Changing the password signs out every other session; this device continues.
- Constant-time login (dummy hash for unknown emails) and identical errors for unknown email and wrong password. Forgot-password never reveals whether an email exists.
- Reset links are single-use, expire after 30 minutes, and are stored hashed.
- Admin accounts cannot be created through sign-up (`create-admin` CLI only).

### Authorization & privacy

- Role-based access on every route. Bookings, chat and live location are checked for party membership. Other users' bookings return **404, not 403**, so IDs can't be probed.
- **Phone numbers are only shared after a technician accepts** a job.
- Public reviews show first name and last initial only.
- **Account deletion** anonymises personal data, deletes messages, cancels open bookings and ends every session, while keeping booking and payment records the other party needs.
- Uploaded photos are **re-encoded** (512px WebP), which strips EXIF/GPS metadata; non-images and decompression bombs are rejected; old files are deleted.

### Abuse resistance

- Redis-backed rate limits: global per IP, stricter on auth endpoints, **per-account failed-login limit**, and on AI triage (which costs money).
- At most 10 open bookings per customer, so calendars can't be blocked with throwaway requests.
- **Race-free booking** through a Postgres exclusion constraint; Stripe-style **Idempotency-Key** support on booking and payment creation.
- Payment webhooks verified with **HMAC-SHA256 over timestamp + raw body**, constant-time comparison, 5-minute replay window, idempotent processing, and at most one successful payment per booking (database constraint).

### Input, output & transport

- Every request validated with Zod (unknown fields stripped); all SQL parameterised; dynamic SQL limited to whitelisted fragments.
- JSON body limit 100 KB, upload limit 2 MB, Postgres `statement_timeout` 10 s.
- **Content-Security-Policy** (`script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`…), HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, COOP on the web app; Helmet on the API; `server_tokens off`.
- Login `?next=` redirects only to same-site paths (no open redirect).
- Errors never expose stack traces; logs redact auth headers, cookies, passwords and tokens.

### Infrastructure

- Production compose: HTTPS via Caddy; Postgres and Redis not exposed; Redis password-protected; all secrets required; containers run **as non-root** (`node`, unprivileged nginx).
- The API refuses to start in production with placeholder secrets or with rate limiting disabled. The sandbox payment gateway and API docs are **off by default** in production.
- `/metrics` and `/health/*` are only reachable inside the Docker network.
- CI: `npm audit` (production deps), lint, typecheck, tests, and **Trivy** scans of both images; Dependabot for npm, Docker and Actions.

## Known limitations

- The per-account login limit (10 failures in 15 minutes) also blocks the real owner for that window, so an attacker who knows an email can lock it temporarily. This is the usual trade-off against password guessing; the lock clears itself.

- MockPay is a sandbox; a real gateway adapter is required before taking real payments.
- No phone ownership (OTP) verification.
- No 2FA for admin accounts yet. Use a long unique password and restrict who has admin access.
