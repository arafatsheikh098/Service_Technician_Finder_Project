<div align="center">

# 🔧 TechFinder

**Trusted home-service technicians at your door, tracked live.**

A geo-aware marketplace for Bangladesh: customers describe a problem in Bangla or English, find
verified electricians, plumbers, AC technicians and more nearby, book a guaranteed time slot, follow
the technician live on a map, chat, pay and leave a review.

[![CI](https://github.com/arafatsheikh098/Service_Technician_Finder_Project/actions/workflows/ci.yml/badge.svg)](https://github.com/arafatsheikh098/Service_Technician_Finder_Project/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Node](https://img.shields.io/badge/Node.js-22-339933)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17%20%2B%20PostGIS-336791)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

<img src="docs/screenshots/visitor/01-home.png" alt="TechFinder home page" width="100%" />

</div>

---

## Contents

- [Who uses TechFinder](#who-uses-techfinder)
- [Try it in 2 minutes](#try-it-in-2-minutes)
- [User guide](#user-guide)
  - [Visitor: browse without an account](#-visitor-browse-without-an-account)
  - [Customer: get something fixed](#-customer-get-something-fixed)
  - [Technician: find work nearby](#-technician-find-work-nearby)
  - [Admin: keep the marketplace trustworthy](#-admin-keep-the-marketplace-trustworthy)
  - [On your phone](#-on-your-phone)
- [Features at a glance](#features-at-a-glance)
- [How it's built](#how-its-built)
- [Running locally](#running-locally)
- [Tests and performance](#tests-and-performance)
- [Security](#security)
- [Deploying to production](#deploying-to-production)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)
- [License](#license)

---

## Who uses TechFinder

| Role              | What they do                                                                          | Where they land after logging in |
| ----------------- | ------------------------------------------------------------------------------------- | -------------------------------- |
| 👀 **Visitor**    | Browses services, searches technicians on the map, reads profiles and reviews         | (not logged in)                  |
| 🏠 **Customer**   | Describes a problem, books a slot, tracks the technician, chats, pays and reviews     | Customer dashboard               |
| 🧰 **Technician** | Goes online, accepts nearby jobs, shares live location, gets paid and builds a rating | Technician dashboard             |
| 🛡️ **Admin**      | Verifies new technicians, watches platform activity, disables abusive accounts        | Platform overview                |

## Try it in 2 minutes

You only need [Docker](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/arafatsheikh098/Service_Technician_Finder_Project.git
cd Service_Technician_Finder_Project
docker compose up --build -d
docker compose exec -e SEED_CONFIRM=erase-all-data api node dist/db/seed.js --force   # load demo data
```

Open **http://localhost:8080** and use a demo account. The password for all of them is **`Demo@12345`**, and the login page has one-click buttons:

| Account    | Email                       |
| ---------- | --------------------------- |
| Customer   | `customer@techfinder.dev`   |
| Technician | `technician@techfinder.dev` |
| Admin      | `admin@techfinder.dev`      |

> 💡 **See the whole journey:** log in as the customer in one window and as the technician in a
> private window. Book _Demo Technician_, accept the job on the other side, press **Start travelling →
> Simulate drive**, and watch the customer's map move in real time.

---

## User guide

### 👀 Visitor: browse without an account

**1. Start on the home page.** Pick your area (or use your current location) and a service, then press **Search**.
The page is fully animated: a rotating headline, a 3D-tilting live-tracking card, scrolling service and review tickers, and a section of **live mini-demos** (chat, radar search, the booking race, status steps) that run on their own. Animations respect your system's _reduce motion_ setting.

<img src="docs/screenshots/visitor/02-home-full.png" alt="Full home page" width="100%" />

<details>
<summary>What's on the rest of the page</summary>

- **Live platform numbers:** verified technicians, jobs completed, average rating (real data from the API)
- **Services:** ten categories, each with a starting price and its Bangla name
- **Top-rated pros around you:** the best matches near your selected area
- **How it works** and **Why TechFinder**
- A **Join as a technician** call to action

</details>

**2. Compare technicians.** Results are ranked by a **match score**, which balances rating (adjusted for how many reviews they have),
distance, how reliably they accept jobs, and experience. Open **"Why this match?"** on any card to see the breakdown. The map shows
each technician's hourly rate; hover a card to highlight its pin. Filter by service chip, a free date and time, radius or sort order.

<img src="docs/screenshots/visitor/03-search.png" alt="Search results with match scores and map" width="100%" />

**3. Read a profile.** Rating, jobs done, experience, acceptance rate, services, bio and recent reviews.
Reviewer names are shortened to protect privacy ("Nusrat U.").

<img src="docs/screenshots/visitor/04-technician-profile.png" alt="Technician public profile" width="100%" />

**4. Create an account.** Choose **I need a service** or **I'm a technician**. Technicians also pick their services,
rate, travel radius and base location on a map. Their profile goes to an admin for verification.

| Join as a technician                                                                      | Log in                                                                                  |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| <img src="docs/screenshots/visitor/05-join-as-technician.png" alt="Technician sign-up" /> | <img src="docs/screenshots/visitor/06-login.png" alt="Login page with demo accounts" /> |

---

### 🏠 Customer: get something fixed

**1. Your dashboard.** Active bookings, completed jobs, how much you've paid, your **next booking** with a countdown,
quick-book shortcuts, a 6-month spending chart, and recent bookings. The sidebar badge counts open bookings, and the 🔔 bell collects live updates.

<img src="docs/screenshots/customer/01-dashboard.png" alt="Customer dashboard" width="100%" />

**2. Not sure which service you need? Describe it.** On the home page open **Describe your problem**, write it in Bangla, English or
Banglish (e.g. _"AC theke pani porche"_), and TechFinder suggests the right service, how urgent it is, and a typical price range taken from
real technician rates. Hazards like gas smells or sparking switches get immediate safety advice.

<img src="docs/screenshots/customer/02-ai-triage.png" alt="AI problem triage" width="100%" />

**3. Book a slot.** Choose the service, date, start time and duration, type your address, drop the pin on the map and describe the problem.
The estimate updates as you go. **The slot is guaranteed:** two people can never book the same technician for overlapping times.

<img src="docs/screenshots/customer/03-book-a-slot.png" alt="Booking form" width="100%" />

**4. Wait for acceptance.** The banner always tells you what's happening and what comes next. You're notified the moment the technician
responds. You can cancel for free until the technician sets off.

<img src="docs/screenshots/customer/04-request-sent.png" alt="Booking request sent" width="100%" />

**5. Track your technician live.** Once they start travelling, their position moves on the map in real time. Chat with them
(share gate codes or directions) and call them. Their phone number is only revealed after they accept.
The **Activity** timeline records every step.

<img src="docs/screenshots/customer/05-live-tracking.png" alt="Live tracking and chat" width="100%" />

**6. Pay when the job is done.** Choose bKash, Nagad or card on the checkout page.

> In this demo the checkout is a clearly-labelled **sandbox**: no real money moves and no payment details are collected.
> In production it is switched off until a real gateway (SSLCommerz / bKash) is connected.

<img src="docs/screenshots/customer/06-checkout.png" alt="Sandbox checkout" width="100%" />

**7. Rate the work.** After paying, leave a 1–5★ review. Reviews feed straight into the technician's ranking.

<img src="docs/screenshots/customer/07-completed-paid-reviewed.png" alt="Completed, paid and reviewed booking" width="100%" />

**8. Manage bookings and your account.**

| My bookings (upcoming / past)                                                | Account: profile, photo, security, delete account                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| <img src="docs/screenshots/customer/08-my-bookings.png" alt="My bookings" /> | <img src="docs/screenshots/customer/09-account.png" alt="Account settings" /> |

---

### 🧰 Technician: find work nearby

**1. Your dashboard.** One switch takes you **online or offline**: when offline you're hidden from search.
New job requests appear instantly with the customer's problem, time, address and price, and you can **Accept** or **Decline**
right there. Fast acceptance improves your ranking. You can also see this month's earnings, your rating, and a 6-month earnings chart.

<img src="docs/screenshots/technician/01-dashboard.png" alt="Technician dashboard with job requests" width="100%" />

**2. Review a request.** Open any request for the full details, then accept or decline.

<img src="docs/screenshots/technician/02-new-request.png" alt="New job request" width="100%" />

**3. Head out and share your location.** Press **Start travelling**, then share your live location with **GPS**
(or **Simulate drive** for demos). The customer sees you approach. Then **Start work → Mark as completed**.

<img src="docs/screenshots/technician/03-on-the-way.png" alt="Technician on the way, sharing location" width="100%" />

**4. Keep your work profile sharp.** Choose services, set your hourly rate, experience, bio and service area (radius on the map).
The **live preview** shows exactly what customers see, and **profile strength** tells you what to improve.

<img src="docs/screenshots/technician/05-work-profile.png" alt="Work profile with live preview" width="100%" />

<details>
<summary>Jobs list</summary>

<img src="docs/screenshots/technician/04-jobs.png" alt="Technician jobs list" width="100%" />

</details>

---

### 🛡️ Admin: keep the marketplace trustworthy

**1. Platform overview.** Customers, technicians, bookings, revenue processed, new bookings per day (hover for values, or open the table view), and bookings by status.

<img src="docs/screenshots/admin/01-overview.png" alt="Admin platform overview" width="100%" />

**2. Verify technicians.** New technicians stay hidden from search until verified. The **Awaiting** tab is your queue.
**Disable** ends a user's sessions and live connections immediately and hides a technician from search.

<img src="docs/screenshots/admin/02-verify-technicians.png" alt="Technician verification queue" width="100%" />

> In production the first admin is created from the server with `create-admin` (admins can't sign up). See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#4-create-the-first-admin).

---

### 📱 On your phone

Every page works at phone width. In the app, the sidebar becomes a slide-out menu.

| Home                                                                            | Dashboard                                                                                 | Menu                                                                            | Booking                                                                               |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| <img src="docs/screenshots/mobile/01-home.png" alt="Mobile home" width="200" /> | <img src="docs/screenshots/mobile/02-dashboard.png" alt="Mobile dashboard" width="200" /> | <img src="docs/screenshots/mobile/03-menu.png" alt="Mobile menu" width="200" /> | <img src="docs/screenshots/mobile/04-booking.png" alt="Mobile booking" width="200" /> |

---

## Features at a glance

|     | Feature                                                                                    | How                                                                              |
| --- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 📍  | **Geo search** within a radius, with the customer inside the technician's own service area | PostGIS `geography`, GiST index, `ST_DWithin`                                    |
| 🏆  | **Explainable ranking** that doesn't let one 5★ review beat 200 4.8★ reviews               | Bayesian rating + proximity + Laplace-smoothed reliability + experience          |
| 🔒  | **No double booking**, even with simultaneous requests                                     | Postgres `EXCLUDE USING gist` on `tstzrange` (tested with 10 parallel requests)  |
| 🔁  | **Booking lifecycle** that can't skip steps                                                | Explicit state machine + row locks + append-only audit log                       |
| 🛰️  | **Live tracking, chat, notifications** across server instances                             | Socket.IO + Redis adapter, authorised rooms, throttled location                  |
| 🤖  | **AI problem triage** in Bangla / English / Banglish                                       | Claude with schema-constrained output; prices from real data; keyword fallback   |
| 💳  | **Payments** shaped like real gateways                                                     | Checkout → HMAC-signed, timestamped, idempotent webhook; one success per booking |
| ♻️  | **Safe retries**                                                                           | Stripe-style `Idempotency-Key` on bookings and payments                          |
| 📨  | **Emails** that never slow requests down                                                   | BullMQ worker with retries and backoff; Mailpit in development                   |
| 📊  | **Dashboards** for every role                                                              | Aggregated summary endpoints + accessible charts with table views                |

## How it's built

```mermaid
flowchart LR
  B[Browser<br/>React 19 + TanStack Query<br/>Leaflet + Socket.IO] -->|HTTPS| C[Caddy<br/>auto TLS]
  C --> N[nginx<br/>SPA + reverse proxy + CSP]
  N --> A1[API instance<br/>Express 5 + TypeScript]
  N --> A2[API instance …]
  A1 & A2 --> PG[(PostgreSQL 17<br/>+ PostGIS)]
  A1 & A2 <--> R[(Redis<br/>queues · rate limits · sockets ·<br/>revocations · live locations)]
  R --> W[Worker<br/>BullMQ: email, cleanup]
  A1 -. optional .-> AI[Claude API]
  GW[Payment gateway] -->|signed webhook| C
```

**Backend:** Node.js 22, TypeScript (strict), Express 5, PostgreSQL 17 + PostGIS, Redis, BullMQ, Socket.IO, Zod, Pino, Prometheus, sharp, Anthropic SDK<br/>
**Frontend:** React 19, Vite, Tailwind CSS 4, Motion (animations), Lenis (smooth scroll), TanStack Query, React Router, Leaflet / OpenStreetMap<br/>
**Quality & ops:** Vitest + Supertest on a real database, ESLint, Prettier, Docker (non-root, multi-stage), nginx, Caddy, GitHub Actions, Trivy, Dependabot, k6

Design decisions and trade-offs: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Running locally

**Everything in Docker** (shown above): `docker compose up --build -d`, then http://localhost:8080.

**Development with hot reload:**

```bash
npm install
cp .env.example .env              # set JWT_ACCESS_SECRET (command in the file)
npm run infra:up                  # Postgres + PostGIS, Redis, Mailpit
npm run db:seed                   # migrate + demo data
npm run dev:api                   # API on http://localhost:8000
npm run dev -w apps/web           # web on http://localhost:5173
npm run dev:worker -w apps/api    # optional: sends emails to Mailpit
```

| URL                                         | What                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------- |
| http://localhost:8080/api/docs              | Interactive API docs (Swagger UI, generated from the Zod schemas)    |
| http://localhost:8025                       | Mailpit: every email the app sends (password resets, booking alerts) |
| `/health/live`, `/health/ready`, `/metrics` | Probes and Prometheus metrics (internal network only)                |

Set `ANTHROPIC_API_KEY` to enable AI triage; without it, the keyword matcher is used.

## Tests and performance

```bash
npm test -w apps/api      # needs the Postgres from `npm run infra:up`
```

**67 tests** run against a real PostGIS database. They cover:

- auth, token rotation and replay detection, password reset
- instant session revocation, account deletion
- RBAC, forged and `alg:none` tokens
- geo search and availability
- the full booking lifecycle and the **10-way concurrent double-booking race**
- idempotent replays and the open-booking cap
- privacy of phone numbers and reviewer names
- signed and replayed payment webhooks
- avatar metadata stripping
- Bangla triage
- the production config guard

**Load test** (`loadtest/search.js`, k6, one API container on a laptop) against the geo-search + ranking endpoint:

| Target      | Achieved                                  | p95    | Errors |
| ----------- | ----------------------------------------- | ------ | ------ |
| 1,000 req/s | 1,000 req/s                               | 2.5 ms | 0%     |
| 2,000 req/s | 1,990 req/s                               | 17 ms  | 0%     |
| 3,000 req/s | ~2,500 req/s (one Node process saturated) | 89 ms  | 0%     |

The API is stateless (Redis holds sockets, rate limits, revocations and queues), so it scales by adding containers.

## Security

Highlights below; the full list of controls is in **[SECURITY.md](SECURITY.md)**.

- **Sessions:** 15-minute access tokens in memory and rotating `httpOnly` refresh cookies with stolen-token detection. Sessions end **instantly** when an account is disabled or deleted, or its password changes.
- **Abuse limits:** per-account login lockout, per-IP rate limits, and a cap on open bookings.
- **Privacy:** phone numbers are hidden until a job is accepted, review names are shortened, uploaded photos have their EXIF/GPS metadata stripped, and users can delete their account.
- **Browser and server hardening:** strict Content-Security-Policy and HSTS, non-root containers, and an API that refuses to start in production with placeholder secrets.

## Deploying to production

`docker-compose.prod.yml` gives you:

- automatic HTTPS (Caddy)
- a private database and a password-protected Redis
- required secrets, restart policies, and resource and log limits

The step-by-step guide covers DNS, configuration, creating the first admin, nightly backups (`scripts/backup-db.sh`), monitoring, secret rotation and a pre-launch checklist: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Project structure

```
apps/
  api/                    Express + TypeScript API and background worker
    migrations/           SQL schema, constraints, triggers, reference data
    src/modules/          auth · users · catalog · technicians · bookings · payments · admin · triage
    src/realtime/         Socket.IO server
    src/jobs/             BullMQ queue and email templates
    src/scripts/          create-admin
    test/                 Integration and security tests
  web/                    React app
    src/pages/            Home, search, profiles, dashboards, bookings, admin, account…
    src/components/       App shell, maps, charts, UI kit
    nginx/                Production nginx config (CSP, caching, proxy)
docs/                     Architecture, deployment guide, screenshots
scripts/                  Database backup
loadtest/                 k6 scripts
docker-compose.yml        Local development / demo stack
docker-compose.prod.yml   Hardened production stack
```

## Roadmap

- [ ] Real SSLCommerz / bKash payment adapters behind `PaymentProvider`
- [ ] Phone verification (OTP) and SMS booking alerts
- [ ] Two-factor authentication for admins
- [ ] Playwright end-to-end tests in CI
- [ ] Technician payouts and a platform commission ledger
- [ ] Installable PWA with push notifications for technicians

## License

[MIT](LICENSE) © arafatsheikh098

---

<sub>v1 (2024) was a JavaScript + MySQL university project. v2 is a ground-up rewrite in TypeScript with a new architecture, security model and user interface.</sub>
