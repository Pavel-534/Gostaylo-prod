-- Stage 131.1 — aggregate shadow L2 accruals by mentor + UTC month (service_role only).

CREATE OR REPLACE VIEW public.referral_shadow_l2_monthly AS
SELECT
  (b.metadata -> 'fintech_snapshot' ->> 'shadow_l2_referrer_id') AS l2_referrer_id,
  (date_trunc('month', b.completed_at AT TIME ZONE 'UTC'))::date AS month_utc,
  COUNT(*)::bigint AS booking_count,
  COALESCE(SUM((b.metadata -> 'fintech_snapshot' ->> 'shadow_l2_thb')::numeric), 0) AS shadow_l2_thb_sum
FROM public.bookings b
WHERE b.status = 'COMPLETED'
  AND b.metadata -> 'fintech_snapshot' ->> 'shadow_l2_thb' IS NOT NULL
  AND (b.metadata -> 'fintech_snapshot' ->> 'shadow_l2_thb')::numeric > 0
  AND (b.metadata -> 'fintech_snapshot' ->> 'shadow_l2_referrer_id') IS NOT NULL
GROUP BY 1, 2;

COMMENT ON VIEW public.referral_shadow_l2_monthly IS
  'Shadow L2 liability rollup by upline + UTC month (Stage 131.1). service_role only.';

GRANT SELECT ON public.referral_shadow_l2_monthly TO service_role;
