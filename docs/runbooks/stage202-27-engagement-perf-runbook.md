# Stage 202.27 — Engagement perf (ops runbook)

## Deploy checklist

1. Apply migration: `migrations/stage202_27_referral_earned_thb_total_rpc.sql`
2. Verify RPC:

```sql
SELECT public.referral_earned_thb_total('<profile_id>');
```

3. Verify bookings index (already from Stage 136 — **no new migration**):

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM bookings
WHERE partner_id = '<partner_id>' AND status = 'COMPLETED';
```

Expect: `Index Scan using idx_bookings_partner_completed`.

4. Smoke `/api/v2/referral/me/engagement` (authenticated):
   - `200`
   - Header `Cache-Control: private, max-age=60, stale-while-revalidate=120`
   - `metrics.earnedThb` unchanged vs pre-deploy for same user

## Cache note

Server cache TTL 60s; tier/quests may lag up to 60s after qualifying events — acceptable for engagement UX.

## Out of scope (moved to 202.27b — done)

- ~~`loadQualifiedHostSets` batch bookings for many L1 invites~~ → `qualified_host_first_completed_booking` RPC
- ~~`getMonthlyGuestReferralSpendThb` Node reduce~~ → `referral_program_monthly_guest_spend_thb` RPC (cap non-atomic fallback path)
