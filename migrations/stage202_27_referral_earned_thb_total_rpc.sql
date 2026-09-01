-- Stage 202.27 — SQL aggregate for lifetime earned referral_ledger (engagement UX).
-- Replaces Node reduce in sumReferralEarnedThb; same filter as qualified-host-metrics.

CREATE OR REPLACE FUNCTION public.referral_earned_thb_total(p_referrer_id text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    round(sum(rl.amount_thb)::numeric, 2),
    0::numeric
  )
  FROM public.referral_ledger rl
  WHERE rl.referrer_id = p_referrer_id
    AND rl.status IN ('earned', 'earned_held');
$$;

COMMENT ON FUNCTION public.referral_earned_thb_total(text) IS
  'Lifetime sum of referral_ledger amount_thb for referrer (earned + earned_held). Stage 202.27 engagement perf.';

GRANT EXECUTE ON FUNCTION public.referral_earned_thb_total(text) TO service_role;
