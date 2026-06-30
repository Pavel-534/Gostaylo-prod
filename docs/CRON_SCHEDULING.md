# Cron scheduling — SSOT (Vercel Hobby + cron-job.org)

[Vercel Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing) allows **at most one invocation per day per cron expression**.  
Expressions like `*/5 * * * *` or `0 * * * *` in `vercel.json` **fail deployment** on Hobby.

**Production pattern:** critical jobs run on **[cron-job.org](https://cron-job.org)** (or Upstash QStash) at the required frequency; **`vercel.json`** keeps **daily** schedules as deploy-valid fallbacks only.

Financial-only detail (hourly thaw / promote / pools): **`docs/CRON_EXTERNAL_FINANCIAL.md`**.

## Auth (all `/api/cron/*`)

SSOT: **`lib/cron/verify-cron-secret.js`** — `assertCronAuthorized`

| Header | Value |
|--------|--------|
| `Authorization` | `Bearer <CRON_SECRET>` |
| or `x-cron-secret` | `<CRON_SECRET>` |

- Missing / wrong secret → **401**
- `CRON_SECRET` not set on server → **503**
- Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the env var is configured.

**cron-job.org:** Request method **GET** or **POST** (both supported on most routes). Set scheduler timeout **≥ 60 s** for `ical-sync`, `draft-digest`, `notification-outbox`.

## Naming on cron-job.org

| Field | Standard |
|-------|----------|
| **Title** | `Airento: <kebab-slug>` (display name from `getSiteDisplayName()` / env) |
| **URL path** | `/api/cron/<kebab-slug>` — must match `app/api/cron/<slug>/route.js` |
| **`ops_job_runs.job_name`** | `<kebab-slug>` only (no brand prefix) |
| **Telegram ops alerts** | `Cron: <kebab-slug>` (system slug, not product copy) |

Rename legacy panel titles (`Gostaylo …`, `GoStayLo …`) to **`Airento: …`** when touching jobs.

---

## Matrix — operational crons (high frequency)

These **must** use cron-job.org in production; Vercel daily alone is insufficient.

| cron-job.org title | API path | cron-job.org schedule | Vercel fallback (`vercel.json`) | Notes |
|--------------------|----------|----------------------|---------------------------------|-------|
| `Airento: ical-sync` | `/api/cron/ical-sync` | `*/30 * * * *` (~30 min) | `0 0 * * *` (00:00 UTC) | `maxDuration` 60 s; `last_sync` only on ≥1 successful source |
| `Airento: notification-outbox` | `/api/cron/notification-outbox` | `*/5 * * * *` | `15 4 * * *` (04:15 UTC) | Requires `NOTIFICATION_OUTBOX=1`; batch 20/run |
| `Airento: exchange-rates-refresh` | `/api/cron/exchange-rates-refresh` | `0 */3 * * *` or `0 */6 * * *` | `0 0 * * *` | FX step target ~3 h — external if more than daily |
| `Airento: push-sweeper` | `/api/cron/push-sweeper` | `*/10 * * * *` (recommended) | *(not in vercel.json)* | Stale chat push batches |
| `Airento: push-token-hygiene` | `/api/cron/push-token-hygiene` | `0 */6 * * *` (recommended) | *(not in vercel.json)* | FCM token cleanup |

See **`docs/CRON_EXTERNAL_FINANCIAL.md`** for escrow / payout / financial-health hourly jobs.

---

## Matrix — daily / weekly (Vercel + optional external duplicate)

| cron-job.org title | API path | Recommended prod schedule | Vercel fallback |
|--------------------|----------|---------------------------|-----------------|
| `Airento: checkin-reminder` | `/api/cron/checkin-reminder` | Daily (align with listing TZ; e.g. 07:00 UTC) | `0 0 * * *` |
| `Airento: review-reminder` | `/api/cron/review-reminder` | Daily | `0 0 * * *` |
| `Airento: draft-digest` | `/api/cron/draft-digest` | Daily (e.g. `0 8 * * *` UTC) | `0 0 * * *` |
| `Airento: cleanup-drafts` | `/api/cron/cleanup-drafts` | Daily | `0 0 * * *` |
| `Airento: escrow-thaw` | `/api/cron/escrow-thaw` | Hourly (external) | `0 0 * * *` |
| `Airento: financial-health-monitor` | `/api/cron/financial-health-monitor` | `30 6 * * *` UTC | `30 6 * * *` |
| `Airento: partner-client-review-invite` | `/api/cron/partner-client-review-invite` | Daily | `30 0 * * *` |
| `Airento: partner-sla-telegram-nudge` | `/api/cron/partner-sla-telegram-nudge` | Every 10 min (external on Hobby) | `0 1 * * *` |
| `Airento: dispute-mediation-monitor` | `/api/cron/dispute-mediation-monitor` | Every 6 h (external) | `0 2 * * *` |
| `Airento: flash-sale-reminder` | `/api/cron/flash-sale-reminder` | Daily | `0 3 * * *` |
| `Airento: wallet-welcome-expiry` | `/api/cron/wallet-welcome-expiry` | Daily | `45 4 * * *` |
| `Airento: referral-reconciliation` | `/api/cron/referral-reconciliation` | Daily | `30 4 * * *` |
| `Airento: referral-unlock` | `/api/cron/referral-unlock` | Daily | `15 5 * * *` |
| `Airento: owner-marketing-digest` | `/api/cron/owner-marketing-digest` | Mon `0 7 * * 1` | `0 7 * * 1` |
| `Airento: referral-team-weekly-digest` | `/api/cron/referral-team-weekly-digest` | Mon `30 7 * * 1` | `30 7 * * 1` |
| `Airento: partner-host-retention` | `/api/cron/partner-host-retention` | Daily | `0 9 * * *` |
| `Airento: process-data-erasure` | `/api/cron/process-data-erasure` | Daily | `0 5 * * *` |

---

## Other external jobs (documented elsewhere)

| cron-job.org title | API path | Schedule | Doc |
|--------------------|----------|----------|-----|
| `Airento: cleanup-storage` | `/api/cron/cleanup-storage?dryRun=false` | Daily ~03:00 UTC | README § Stage 95.1 |
| `Airento: cleanup-test-data` | `/api/cron/cleanup-test-data?dryRun=false` | Nightly CI / manual | `TECHNICAL_MANIFESTO` §95.5 |
| `Airento: promote-ready-for-payout` | `/api/cron/promote-ready-for-payout` | Hourly | `CRON_EXTERNAL_FINANCIAL.md` |
| `Airento: payout-batch-pools` | `/api/cron/payout-batch-pools` | Mon & Thu 07:00 UTC | `CRON_EXTERNAL_FINANCIAL.md` |

---

## Observability

| Mechanism | Jobs |
|-----------|------|
| **`ops_job_runs`** | `ical-sync`, `draft-digest`, `notification-outbox`, `push-sweeper`, `push-token-hygiene`, financial crons, … |
| **`/admin/health`** | Aggregates selected `ops_job_runs` (see `lib/admin/ops-job-health.js`) |
| **Telegram** | `notifySystemAlert` on cron exceptions and selected degradation (`ical-sync` source errors, outbox crash, …) |

---

## Verify after deploy

```bash
# Smoke one job (replace slug)
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://<production-domain>/api/cron/draft-digest"

# Financial pipeline
CRON_SECRET=xxx BASE_URL=https://<domain> node scripts/financial-prelaunch-smoke.mjs
```

---

*SSOT for scheduling. When adding a cron route: register in `vercel.json` (daily on Hobby), document external frequency here, use `Airento: <slug>` on cron-job.org.*
