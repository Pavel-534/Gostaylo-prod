# Financial cron — Vercel Hobby + cron-job.org

[Vercel Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing) allows **at most one cron invocation per day per expression**.  
Expressions like `0 * * * *` (hourly) **fail deployment**.

Financial routes stay **API routes** protected by `CRON_SECRET`.  
**Do not** add hourly jobs to `vercel.json` on Hobby — use [cron-job.org](https://cron-job.org) (or Upstash QStash).

## Routes (all require secret)

| Route | Method | Hobby: Vercel `vercel.json` | cron-job.org schedule |
|-------|--------|----------------------------|------------------------|
| `/api/cron/escrow-thaw` | POST | Daily 00:00 UTC (fallback) | **Every hour** |
| `/api/cron/promote-ready-for-payout` | POST | **Not in vercel.json** | **Every hour** |
| `/api/cron/payout-batch-pools` | POST | **Not in vercel.json** | Mon & Thu 07:00 UTC |
| `/api/cron/financial-health-monitor` | POST | Daily 06:30 UTC | Daily 06:30 UTC (optional duplicate) |

## cron-job.org setup

1. Create account → **Cronjobs** → **Create cronjob**.
2. For each job:
   - **URL:** `https://<your-production-domain>/api/cron/<path>`
   - **Request method:** POST
   - **Schedule:** see table
   - **Headers:**
     - `Authorization: Bearer <CRON_SECRET>`
     - or `x-cron-secret: <CRON_SECRET>`
3. **payout-batch-pools** — enable **Request body** (JSON): `{"force":false}`  
   For manual test: `{"force":true}` (creates pool off Mon/Thu).

### Suggested schedules (cron-job.org UI)

| Job | Cron expression | Notes |
|-----|-----------------|-------|
| escrow-thaw | `0 * * * *` | Every hour at :00 |
| promote-ready-for-payout | `0 * * * *` | Every hour at :00 |
| payout-batch-pools | `0 7 * * 1,4` | Mon & Thu 07:00 UTC |
| financial-health-monitor | `30 6 * * *` | Daily 06:30 UTC |

4. Set **CRON_SECRET** in Vercel → Project → Settings → Environment Variables (Production).

## Verify after deploy

```bash
CRON_SECRET=xxx BASE_URL=https://your-domain EXPECT_PRICING_V2=true \
  node scripts/financial-prelaunch-smoke.mjs
# or: npm run smoke:financial
```

## Local test

```bash
curl -X POST "http://localhost:3000/api/cron/promote-ready-for-payout" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Without secret → **401**. Without `CRON_SECRET` env on server → **503**.
