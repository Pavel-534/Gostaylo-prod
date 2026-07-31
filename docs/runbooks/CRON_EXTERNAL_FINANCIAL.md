# Financial cron — Vercel Hobby + cron-job.org

[Vercel Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing) allows **at most one cron invocation per day per expression**.  
Expressions like `0 * * * *` (hourly) **fail deployment**.

Financial routes stay **API routes** protected by `CRON_SECRET` (`lib/cron/verify-cron-secret.js`).  
**Do not** add hourly jobs to `vercel.json` on Hobby — use [cron-job.org](https://cron-job.org) (or Upstash QStash).

**Code SSOT (Stage 200):** `lib/cron/cron-registry.js` — path, criticality, vercel vs external, recommended schedules.  
Partner **auto bank payouts remain Concierge/manual** until ops are proven; `payout-batch-pools` only drafts pools.

## Money-critical routes

| Route | Method | Hobby: Vercel `vercel.json` | cron-job.org schedule |
|-------|--------|----------------------------|------------------------|
| `/api/cron/escrow-thaw` | POST | Daily 00:00 UTC (fallback) | **Every hour** |
| `/api/cron/promote-ready-for-payout` | POST | **Not in vercel.json** | **Every hour** |
| `/api/cron/payout-batch-pools` | POST | **Not in vercel.json** | Mon & Thu 07:00 UTC (draft pool only) |
| `/api/cron/financial-health-monitor` | POST | Daily 06:30 UTC | Daily 06:30 UTC (optional duplicate) |
| `/api/cron/ical-sync` | POST | Daily fallback | **~30 min** recommended |

All other handlers: see `CRON_REGISTRY` in `lib/cron/cron-registry.js` (auth guard required on every route).

## cron-job.org setup

1. Create account → **Cronjobs** → **Create cronjob**.
2. For each job:
   - **URL:** `https://<your-production-domain>/api/cron/<path>`
   - **Request method:** POST
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
| escrow-thaw | `0 * * * *` | Every hour at :00 |
| promote-ready-for-payout | `0 * * * *` | Every hour at :00 |
| payout-batch-pools | `0 7 * * 1,4` | Mon & Thu 07:00 UTC — draft only |
| financial-health-monitor | `30 6 * * *` | Daily 06:30 UTC |
| ical-sync | `*/30 * * * *` | Calendar freshness |

4. Set **CRON_SECRET** in Vercel → Project → Settings → Environment Variables (Production).

## Verify after deploy

```bash
CRON_SECRET=xxx BASE_URL=https://your-domain EXPECT_PRICING_V2=true \
  node scripts/financial-prelaunch-smoke.mjs
# or: npm run smoke:financial
```

FinTech UI: cron freshness from `ops_job_runs` (`lib/admin/financial-cron-health.js`).

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
