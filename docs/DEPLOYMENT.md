# Deploying TechFinder to production

This guide takes a fresh Linux server to a running HTTPS deployment using
`docker-compose.prod.yml`. Budget about 30 minutes.

## 1. What you need

| Item                    | Notes                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A Linux server          | 2 vCPU / 4 GB RAM is plenty to start (Ubuntu 24.04 LTS, Debian 12…). Docker Engine 24+ with the compose plugin.                                        |
| A domain name           | An `A` (and `AAAA` if you have IPv6) record pointing at the server, e.g. `techfinder.example.com`.                                                     |
| Open ports              | **80** and **443** only (Caddy needs 80 for the certificate challenge). Block everything else except SSH.                                              |
| SMTP provider           | Amazon SES, Mailgun, Brevo, Zoho… for password-reset and booking emails. Configure SPF/DKIM for the sender domain.                                     |
| Map tile provider       | MapTiler, Stadia Maps, or self-hosted. The public OpenStreetMap tile servers [forbid heavy use](https://operations.osmfoundation.org/policies/tiles/). |
| Off-site backup storage | S3, Backblaze B2, or another server.                                                                                                                   |

## 2. Configure

```bash
git clone https://github.com/<you>/Service_Technician_Finder_Project.git /srv/techfinder
cd /srv/techfinder
cp .env.production.example .env.production
chmod 600 .env.production
```

Fill in **every** value. Generate each secret separately:

```bash
openssl rand -hex 32   # POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_ACCESS_SECRET, PAYMENT_WEBHOOK_SECRET
```

Use hex secrets: they are embedded in connection URLs, where characters such as
`@`, `/` or `:` would break parsing.

The stack **refuses to start** if a required value is missing, and the API refuses to
start if a secret still looks like a placeholder.

## 3. Launch

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

On first start the API runs the database migrations (guarded by an advisory lock,
so several instances can start at once) and creates the service catalog. Caddy
obtains the TLS certificate automatically; the site is live at `https://$DOMAIN`.

> Never run `db:seed` in production. It **truncates every table** and loads demo
> data. It refuses to run unless you pass `--force` _and_ set
> `SEED_CONFIRM=erase-all-data`.

## 4. Create the first admin

Admins cannot sign up through the website. Create one from the server:

```bash
read -s ADMIN_PASSWORD   # typed, not echoed, not saved in shell history
export ADMIN_PASSWORD
docker compose -f docker-compose.prod.yml --env-file .env.production exec \
  -e ADMIN_EMAIL=you@example.com -e ADMIN_NAME="Your Name" -e ADMIN_PASSWORD \
  api node dist/scripts/create-admin.js
unset ADMIN_PASSWORD
```

Admin passwords need at least 12 characters. Log in at `https://$DOMAIN/login`; new
technicians wait in **Platform overview → Technicians → Awaiting** for verification.

## 5. Backups

```bash
crontab -e
# every night at 02:30, keep 14 days locally
30 2 * * * cd /srv/techfinder && ./scripts/backup-db.sh >> backups/backup.log 2>&1
```

Then ship `backups/` off the server (e.g. `rclone sync backups remote:techfinder-backups`).
**Test a restore** at least once (the restore command is at the top of
`scripts/backup-db.sh`). Uploaded avatars live in the `uploads` Docker volume; back it up too,
or move uploads to object storage.

## 6. Updating

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Migrations run automatically on start. Take a backup first. Migrations are
forward-only: to roll back code, restore the backup taken before the upgrade.

## 7. Operations

| Task                            | How                                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logs                            | `docker compose -f docker-compose.prod.yml logs -f api worker` (JSON lines; each request has a `reqId`, also returned to clients as `X-Request-Id`). Log files rotate at 10 MB × 5. |
| Health                          | `api` has a Docker healthcheck on `/health/ready` (checks Postgres and Redis). Point an uptime monitor (UptimeRobot, Better Stack) at `https://$DOMAIN/`.                           |
| Metrics                         | Prometheus format at `http://api:8000/metrics`, reachable **only inside the Docker network** (not proxied by nginx). Scrape it from a Prometheus container on the same network.     |
| Disable a user                  | Admin → user status. Their sessions and live connections end immediately.                                                                                                           |
| Rotate `JWT_ACCESS_SECRET`      | Change it and restart `api`. All access tokens become invalid; users are silently refreshed through their refresh cookie.                                                           |
| Rotate `PAYMENT_WEBHOOK_SECRET` | Update it here and in the gateway dashboard at the same time.                                                                                                                       |
| Rotate DB / Redis passwords     | `ALTER USER techfinder PASSWORD '…'` / update `REDIS_PASSWORD`, then update `.env.production` and restart.                                                                          |
| Scale the API                   | The API is stateless (sessions in Postgres; sockets, rate limits and revocations in Redis). Run more `api` replicas behind nginx.                                                   |

## 8. Pre-launch checklist

- [ ] DNS points to the server; `https://$DOMAIN` shows a valid certificate
- [ ] All secrets generated with `openssl rand -hex 32`, unique, and `.env.production` is `chmod 600` and not in git
- [ ] Firewall: only 22, 80, 443 open (`ufw allow 22,80,443/tcp && ufw enable`); SSH key-only login
- [ ] SMTP verified: request a password reset and confirm the email arrives (check spam, SPF/DKIM)
- [ ] Map tiles point at a production tile provider and `MAP_TILE_ORIGINS` matches it (otherwise the CSP blocks them)
- [ ] `MOCKPAY_ENABLED=false` for real customers (sandbox payments only for demos). Online payment returns _"not available yet"_ until a real gateway adapter is added (see below)
- [ ] `API_DOCS_ENABLED=false` (default) unless you intend to publish the API
- [ ] First admin created; demo accounts **not** present
- [ ] Nightly backups running, copied off-site, and a restore tested
- [ ] Uptime monitor configured
- [ ] Privacy policy and terms published (the app stores names, phone numbers, addresses and locations)

## Known gaps before taking real money

- **Payment gateway:** only the MockPay sandbox is implemented. Add an SSLCommerz or
  bKash adapter (implement `PaymentProvider` and its webhook signature check in
  `apps/api/src/modules/payments/payments.routes.ts`), then complete their merchant onboarding.
- **Uploads on local disk:** fine on one server. For several servers, move avatars to
  S3-compatible storage (`apps/api/src/modules/users/users.routes.ts` is the only place that writes them).
- **No phone/OTP verification:** phone numbers are format-checked only.
