-- Stage 131.A6 — Public leaderboard all-time (earned referral_ledger aggregation).
--
-- Authoritative SSOT: aggregate only `status='earned'` without earned_at period bounds.

CREATE OR REPLACE FUNCTION public.referral_ledger_leaderboard_alltime(
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
  GROUP BY rl.referrer_id
  ORDER BY total_thb DESC
  LIMIT greatest(1, least(coalesce(nullif(p_limit, 0), 10), 100));
$$;

COMMENT ON FUNCTION public.referral_ledger_leaderboard_alltime(integer) IS
  'Топ рефереров по сумме earned referral_ledger за весь lifetime. Stage 131.A6.';

GRANT EXECUTE ON FUNCTION public.referral_ledger_leaderboard_alltime(integer)
  TO authenticated, service_role;

