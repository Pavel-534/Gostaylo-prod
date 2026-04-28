-- Stage 74.2 — агрегация лидерборда на стороне БД (SSOT), без полной выгрузки referral_ledger в Node.

CREATE OR REPLACE FUNCTION public.referral_ledger_leaderboard_for_period(
  p_period_start timestamptz,
  p_period_end_exclusive timestamptz,
  p_limit integer
)
RETURNS TABLE (referrer_id text, total_thb numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT rl.referrer_id,
         round(sum(rl.amount_thb)::numeric, 2) AS total_thb
  FROM public.referral_ledger rl
  WHERE rl.status = 'earned'
    AND rl.earned_at IS NOT NULL
    AND rl.earned_at >= p_period_start
    AND rl.earned_at < p_period_end_exclusive
  GROUP BY rl.referrer_id
  ORDER BY total_thb DESC
  LIMIT greatest(1, least(coalesce(nullif(p_limit, 0), 10), 100));
$$;

COMMENT ON FUNCTION public.referral_ledger_leaderboard_for_period(timestamptz, timestamptz, integer) IS
  'Топ рефереров по сумме earned referral_ledger за полуинтервал [start, end). Stage 74.2.';

GRANT EXECUTE ON FUNCTION public.referral_ledger_leaderboard_for_period(timestamptz, timestamptz, integer)
  TO authenticated, service_role;
