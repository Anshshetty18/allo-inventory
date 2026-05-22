# Allo Inventory — Engineering Take-Home

A production-grade inventory reservation platform for multi-warehouse retail. Built with Next.js 16, Prisma 6, Neon (Postgres), Upstash Redis, and shadcn/ui.

**Live URL:** _(deploy to Vercel and paste here)_  
**GitHub:** _(your repo URL)_

---

## Quick Start (Local Development)

### 1. Prerequisites

- Node.js ≥ 20
- A Neon account (free) — [neon.tech](https://neon.tech)
- An Upstash Redis account (free) — [upstash.com](https://upstash.com)

### 2. Clone & Install

```bash
git clone <your-repo>
cd allo-inventory
npm install
```

### 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (`?pgbouncer=true`) |
| `DIRECT_URL` | Neon direct connection string (for migrations) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `CRON_SECRET` | Random secret to protect the cron endpoint |
| `NEXT_PUBLIC_APP_URL` | Your app base URL |

**Neon URLs:** In your Neon dashboard, the pooled URL ends in `?sslmode=require` — add `&pgbouncer=true&connect_timeout=15` for DATABASE_URL, and use the direct URL (without pgbouncer) for DIRECT_URL.

### 4. Database Setup

```bash
# Run migrations
npx prisma migrate deploy

# Seed with sample products and warehouses
npx prisma db seed
```

### 5. Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## How the Expiry Mechanism Works

### In Development / Local

Expiry is handled **lazily on read**: whenever a reservation is fetched (GET `/api/reservations/:id`) and the server finds `status = pending` AND `expiresAt < now`, it atomically releases the hold and updates the status to `released` in the same transaction before returning the response.

### In Production (Vercel)

**Two complementary mechanisms:**

1. **Lazy cleanup on read** (immediate, zero infrastructure) — same as development. Any API call touching a specific reservation handles its own expiry. This ensures a user who sits on the checkout page and then confirms gets an immediate 410 if time ran out.

2. **Vercel Cron job** (background sweeper) — `vercel.json` schedules `GET /api/cron/expire-reservations` every 5 minutes. This releases abandoned reservations that nobody reads, ensuring stock returns to available even for ghost sessions.

```json
{
  "crons": [{ "path": "/api/cron/expire-reservations", "schedule": "*/5 * * * *" }]
}
```

The cron endpoint is protected by a `Bearer <CRON_SECRET>` check in production (Vercel automatically sends this via the `Authorization` header).

**Why both?** The cron alone has a 5-minute lag — lazy cleanup removes that lag for active users. The cron alone handles users who close the tab without cancelling.

---

## How Concurrency Safety Works

The core of this exercise is ensuring that if two requests arrive simultaneously for the last unit of a SKU, exactly one succeeds and the other gets a 409.

### Implementation: PostgreSQL `SELECT FOR UPDATE`

```sql
-- Inside a Prisma $transaction:
SELECT id, "totalUnits", "reservedUnits"
FROM inventory
WHERE "productId" = $1 AND "warehouseId" = $2
FOR UPDATE;  -- ← Row-level lock acquired here
```

When Transaction A takes the lock, Transaction B **blocks** at `FOR UPDATE` (it does not read stale data — it waits). When A commits and increments `reservedUnits`, B unblocks and re-reads the now-updated row. B then sees `availableUnits = 0` and returns 409.

This is ACID-correct, serialisable for this row, and requires no external coordination (no Redis locks needed for the reservation logic itself).

**Why not Redis `SETNX` locks?** Postgres row locks are simpler, can't be missed if Redis is down, and already live in the source of truth. Redis is used only for idempotency caching where its eventual consistency is acceptable.

---

## Idempotency (Bonus)

Both `POST /api/reservations` and `POST /api/reservations/:id/confirm` support the `Idempotency-Key` header.

### How it works

1. Client generates a UUID and sends it as `Idempotency-Key: <uuid>`
2. Before executing the mutation, the server checks Redis for key `idempotency:{endpoint}:{uuid}`
3. If found: returns the cached response (same status code + body) — **no side effect repeated**
4. If not found: executes the mutation, stores `{ status, body }` in Redis with 24h TTL, returns fresh response

### What this prevents

- Payment SDK retrying a reservation after a network timeout → same reservation returned, no duplicate hold
- Client retrying a confirm after a 5XX → same confirmed response, stock not decremented twice

The frontend generates a new idempotency key per attempt, not per session, so intentional retries (different UUIDs) work correctly.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/products` | List products with available stock per warehouse |
| `GET` | `/api/warehouses` | List warehouses |
| `GET` | `/api/reservations/:id` | Get reservation details (with lazy expiry) |
| `POST` | `/api/reservations` | Reserve units — 409 if insufficient stock |
| `POST` | `/api/reservations/:id/confirm` | Confirm payment — 410 if expired |
| `POST` | `/api/reservations/:id/release` | Release reservation early |
| `GET` | `/api/cron/expire-reservations` | Background sweep (Vercel Cron) |

---

## Data Model

```
Product ─── Inventory ─── Warehouse
             (totalUnits, reservedUnits)
               │
           Reservation
           (pending → confirmed / released)
```

`availableUnits = totalUnits - reservedUnits` is computed, never stored, to avoid an extra column that could drift out of sync.

On **confirm**: `totalUnits -= quantity`, `reservedUnits -= quantity` (permanent sale)  
On **release**: `reservedUnits -= quantity` (units return to pool)

---

## Seeded Demo Data

| Product | Mumbai | Bengaluru | Delhi NCR |
|---|---|---|---|
| AirMax Pro Sneakers | 50 | 30 | **5** (low) |
| EliteTime Smart Watch | 20 | **2** (very low) | 15 |
| TrekMate Backpack 45L | 80 | — | 40 |
| SoundWave Pro Headphones | **1** (last!) | 25 | 12 |
| LensMax DSLR Camera | 8 | 3 | — |

**Recommended demo scenarios:**
- Reserve SoundWave at Mumbai in two browser tabs simultaneously → one succeeds, one gets 409
- Wait for a reservation to expire → confirm gets 410
- Retry with the same `Idempotency-Key` → same response

---

## Deployment (Vercel)

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "feat: initial implementation"
git remote add origin <your-github-url>
git push -u origin main

# 2. Import to Vercel and add environment variables:
#    DATABASE_URL, DIRECT_URL, UPSTASH_REDIS_REST_URL,
#    UPSTASH_REDIS_REST_TOKEN, CRON_SECRET, NEXT_PUBLIC_APP_URL

# 3. After first deploy, run migrations:
npx prisma migrate deploy  # or enable migrate in build script

# 4. Seed the database (run once):
npx prisma db seed
```

---

## Trade-offs & What I'd Do Differently

### What I deliberately left out

- **Authentication / user identity** — reservations are anonymous (identified only by ID in the URL). In production you'd tie a reservation to a user session so only the holder can confirm/release it.
- **Payment provider integration** — the "Confirm purchase" button is a stub. In production it would initiate a payment, and the confirm endpoint would be called by a payment webhook, not the browser.
- **Email / push notifications** — no notification when reservation expires.
- **Audit log** — no history of who touched a reservation. Would add a `ReservationEvent` table in production.

### What I'd do differently with more time

- **Replace `$queryRaw` with Prisma's native `update` with `where` conditions** once Prisma adds `FOR UPDATE` support natively. The raw SQL works but loses type safety.
- **Partition the `reservations` table by `status`** to keep the pending-sweep query fast at scale.
- **Add a dead-letter queue** for failed cron sweeps so no expired reservation is silently missed.
- **WebSocket / SSE** for real-time countdown sync between browser and server, so the countdown can't drift if the client clock is wrong.
- **Optimistic UI** — refresh stock in real-time using polling or SSE, so the product grid stays fresh without a page reload.

### Concurrency note

The `SELECT FOR UPDATE` approach serialises one row at a time. Under extreme load (thousands of concurrent requests per SKU), this becomes a lock queue. A more scalable approach would be `UPDATE inventory SET "reservedUnits" = "reservedUnits" + $qty WHERE ... AND ("totalUnits" - "reservedUnits") >= $qty RETURNING id` — an atomic conditional update with a single round trip. I chose `SELECT FOR UPDATE` because it makes the intent explicit and is easier to audit in code review.
