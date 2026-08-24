# Financial cron — Vercel Hobby + cron-job.org

[Vercel Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing) allows **at most one cron invocation per day per expression**.  
Expressions like `0 * * * *` (hourly) **fail deployment**.

Financial routes stay **API routes** protected by `CRON_SECRET` (`lib/cron/verify-cron-secret.js` — **timingSafeEqual**, AUDIT_03 W3.12).  
**Do not** add hourly jobs to `vercel.json` on Hobby — use [cron-job.org](https://cron-job.org) (or Upstash QStash).

**Code SSOT (Stage 200):** `lib/cron/cron-registry.js` — path, criticality, vercel vs external, recommended schedules.  
Partner **auto bank payouts remain Concierge/manual** until ops are proven; `payout-batch-pools` only drafts pools.

**Prod host:** `https://airento.ru` (no `www` — avoid 301 false failures).

## Money-critical routes

| Route | Method | Hobby: Vercel `vercel.json` | cron-job.org schedule |
|-------|--------|----------------------------|------------------------|
| `/api/cron/escrow-thaw` | POST | Daily 00:00 UTC (fallback) | **Every hour** |
| `/api/cron/reconcile-confirmed-payments` | POST | Daily 00:00 UTC (fallback) | **Every hour** (AUDIT_03 C3.4 + intents/crypto heal) |
| `/api/cron/reconcile-yookassa-pending` | POST | Daily 02:00 UTC (fallback) | **Every 10 min** `*/10 * * * *` (Stage 202.7 — INITIATED MIR poll) |
| `/api/cron/promote-ready-for-payout` | POST | **Not in vercel.json** | **Every hour** |
| `/api/cron/payout-batch-pools` | POST | **Not in vercel.json** | Mon & Thu 07:00 UTC (draft pool only) |
| `/api/cron/financial-health-monitor` | POST | Daily 06:30 UTC | Daily 06:30 UTC (optional duplicate) |
| `/api/cron/ledger-shadow-reconcile` | POST | Daily 06:45 UTC | Daily 06:45 UTC (ADR-203 Phase 1 shadow) |
| `/api/cron/cleanup-critical-signals` | GET/POST | Daily 05:00 UTC | Optional duplicate (AUDIT_03 M3.6) |
| `/api/cron/ical-sync` | POST | Daily fallback | **~30 min** recommended |

All other handlers: see `CRON_REGISTRY` in `lib/cron/cron-registry.js` (auth guard required on every route).

## Escrow thaw SLO (AUDIT_03 W3.9)

| Scheduler | Cadence | Max lag after `escrow_thaw_at` |
|-----------|---------|--------------------------------|
| **cron-job.org** (canonical) | Hourly `0 * * * *` | **≤ 59 minutes** |
| **Vercel Hobby** daily fallback | `0 0 * * *` UTC | **≤ 23h 59min** |

Ops expectation: production thaw freshness is defined by the **external hourly** job. Daily Vercel is only a safety net if cron-job.org is down.  
If both run the same hour, thaw must remain **idempotent** (safe double-run) — see Duplicate run protection below.

## Duplicate run protection (AUDIT_03 W3.13)

Vercel Hobby (daily fallback in `vercel.json`) **plus** cron-job.org (real hourly/custom) **will** occasionally invoke the same route twice close together.

| Rule | Guidance |
|------|----------|
| Money jobs (`escrow-thaw`, `reconcile-confirmed-payments`, `promote-ready-for-payout`, ledger-ish) | Must be **idempotent** — status/CAS filters, unique idempotency keys, “already done” → 2xx |
| Email / marketing digests | Prefer `ops_job_runs` dedup: same `job_name` + `date_trunc('hour', now())` (or day) before send |
| Outbox / push sweepers | Safe re-entry; claim rows before mutate |

Do **not** disable the Vercel daily fallback solely to avoid duplicates — prefer idempotent handlers. Keep **one** active cron-job.org entry per logical job (avoid two Escrow Thaw titles both Enabled).

## cron-job.org setup

1. Create account → **Cronjobs** → **Create cronjob**.
2. For each job:
   - **URL:** `https://airento.ru/api/cron/<path>`
   - **Request method:** POST (unless route documents GET=run, e.g. cleanup-critical-signals / review-reminder)
   - **Schedule:** see table / registry
   - **Headers:**
     - `Authorization: Bearer <CRON_SECRET>`
     - or `x-cron-secret: <CRON_SECRET>`
3. **payout-batch-pools** — enable **Request body** (JSON): `{"force":false}`  
   For manual test: `{"force":true}` (creates pool off Mon/Thu).  
   **Does not send money** — Concierge still executes payouts manually.

### Suggested schedules (cron-job.org UI)

| Job | Cron expression | Notes |
|-----|-----------------|-------|
| escrow-thaw | `0 * * * *` | Every hour at :00 — SLO ≤59m |
| reconcile-confirmed-payments | `0 * * * *` | Every hour — heal CONFIRMED∧¬escrow + PAID intents / CRYPTO+txid (≥5m) |
| reconcile-yookassa-pending | `*/10 * * * *` | Every 10 min — INITIATED MIR_RU ↔ YooKassa GET (webhook lag) |
| promote-ready-for-payout | `0 * * * *` | Every hour at :00 |
| payout-batch-pools | `0 7 * * 1,4` | Mon & Thu 07:00 UTC — draft only |
| financial-health-monitor | `30 6 * * *` | Daily 06:30 UTC |
| cleanup-critical-signals | `0 5 * * *` | Daily — 90d retention (M3.6) |
| ical-sync | `*/30 * * * *` | Calendar freshness |

4. Set **CRON_SECRET** in Vercel → Project → Settings → Environment Variables (Production).

## Verify after deploy

```bash
CRON_SECRET=xxx BASE_URL=https://airento.ru EXPECT_PRICING_V2=true \
  node scripts/financial-prelaunch-smoke.mjs
# or: npm run smoke:financial
```

FinTech UI: cron freshness from `ops_job_runs` (`lib/admin/financial-cron-health.js`) — age from **last `status=success` only**.

### Stale monitor (AUDIT_MONEY_FLOW_04 P1)

`lib/ops/stale-cron-monitor.js` (`runStaleCronMonitor`):

| Job | Cadence | Stale if last success older than |
|-----|---------|----------------------------------|
| `escrow-thaw` | hourly | **2h** |
| `promote-ready-for-payout` | hourly | **2h** |
| `reconcile-confirmed-payments` | hourly | **2h** |
| `reconcile-yookassa-pending` | ~10 min | **45m** |
| `ledger_shadow_reconcile` | daily | **26h** |

Alert: TG **`[STALE_CRON] {jobName}`** + `critical_signal_events` (`STALE_CRON`). Invoked from `financial-health-monitor` and after hourly `escrow-thaw` / `reconcile-confirmed-payments` (does not change money mutations).

### Soft fail ≠ ops success

Empty work stays **`success`**. DB / freeze / compare failures → **`error`** (+ TG) for `escrow-thaw`, `payout-batch-pools`, `ledger_shadow_reconcile`, reconcile. Helpers: `lib/ops/ops-job-outcome.js`.

## Local test

```bash
curl -X POST "http://localhost:3000/api/cron/promote-ready-for-payout" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Without secret → **401**. Without `CRON_SECRET` env on server → **503**.

## Stage 200 contract tests

```bash
node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-operational-reliability.test.js
```
