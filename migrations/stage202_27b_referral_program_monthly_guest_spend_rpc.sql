-- Stage 202.27b — global guest_booking monthly spend (cap fallback read path).
-- Mirrors SUM filter in referral_program_cap_reserve (Stage 131.A4) without FOR UPDATE.

CREATE OR REPLACE FUNCTION public.referral_program_monthly_guest_spend_thb(
  p_utc_month_start timestamptz
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    ROUND(SUM(rl.amount_thb)::numeric, 2),
    0::numeric
  )
  FROM public.referral_ledger rl
  WHERE rl.referral_type = 'guest_booking'
    AND rl.status IN ('pending', 'earned', 'earned_held')
    AND rl.created_at >= p_utc_month_start;
$$;

COMMENT ON FUNCTION public.referral_program_monthly_guest_spend_thb(timestamptz) IS
  'Stage 202.27b — program-wide guest_booking accrual sum since UTC month start (cap fallback).';

GRANT EXECUTE ON FUNCTION public.referral_program_monthly_guest_spend_thb(timestamptz) TO service_role;
