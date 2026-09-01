# Stage 202.30 — me/rank perf (ops runbook)

## Deploy checklist

1. Apply migration: `migrations/stage202_30_referral_user_rank_for_period_rpc.sql`

2. Verify RPC:

```sql
SELECT *
FROM public.referral_user_rank_for_period(
  '<profile_id>',
  date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',
  (date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'
);
```

Expect: one row `{ rank, total_ambassadors, my_earned_thb, above_earned_thb }` or empty month totals.

3. Smoke `GET /api/v2/referral/me/rank` (authenticated):
   - Same JSON keys: `rank`, `total_ambassadors`, `as_of`, `earned_bucket_thb`, `next_rank_bucket_hint`
   - User with 0 earned: `rank: null`, `total_ambassadors` = active count in month
   - Cache: `unstable_cache` revalidate 600s (unchanged)

4. Optional EXPLAIN:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.referral_user_rank_for_period('...', '2026-09-01'::timestamptz, '2026-10-01'::timestamptz);
```

Index hint: `idx_referral_ledger_analytics_core (referrer_id, status, earned_at DESC)`.

## Semantics

Filters match `referral_ledger_leaderboard_for_period` (Stage 74.2) — **not** cap/guest_booking path.

Rank uses `ROW_NUMBER()` with `referrer_id ASC` tie-break (deterministic SQL; legacy fallback preserves pre-202.30 Node scan).
