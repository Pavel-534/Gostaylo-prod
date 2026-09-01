# Stage 202.27b — Referral hot spots perf (ops runbook)

## Deploy checklist

1. Apply migrations (order independent):
   - `migrations/stage202_27b_qualified_host_first_completed_booking_rpc.sql`
   - `migrations/stage202_27b_referral_program_monthly_guest_spend_rpc.sql`

2. Verify qualified-host RPC:

```sql
SELECT * FROM public.qualified_host_first_completed_booking(ARRAY['<partner_profile_id>']);
```

Expect: one row per partner with earliest `COMPLETED` booking timestamp (or empty).

3. Verify monthly guest spend RPC:

```sql
SELECT public.referral_program_monthly_guest_spend_thb(
  date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
);
```

Expect: numeric sum matching legacy Node reduce for current UTC month.

4. Smoke `/api/v2/referral/me/engagement` (authenticated):
   - `200`
   - `metrics.qualifiedHosts` / `qualifiedHostsLast30d` unchanged vs pre-deploy for same user

5. Cap fallback path (only when `referral_program_cap_reserve` RPC unavailable):
   - `resolveReferralProgramCapGate` spent total matches pre-deploy for same month

## Performance note

`loadQualifiedHostSets` no longer fetches all COMPLETED booking rows for L1 invites — Postgres aggregates via `qualified_host_first_completed_booking`.

## Related

- Stage 202.27 — `referral_earned_thb_total` + engagement route cache (`docs/runbooks/stage202-27-engagement-perf-runbook.md`)
- Bookings index: `idx_bookings_partner_completed` (Stage 136) — unchanged
