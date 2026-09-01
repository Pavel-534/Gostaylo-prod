-- Stage 202.30 — monthly user rank for /api/v2/referral/me/rank (mirrors referral_ledger_leaderboard_for_period).
-- ROW_NUMBER tie-break: earned DESC, referrer_id ASC (deterministic; legacy Node used unordered scan + thb sort).

CREATE OR REPLACE FUNCTION public.referral_user_rank_for_period(
  p_user_id text,
  p_period_start timestamptz,
  p_period_end_exclusive timestamptz
)
RETURNS TABLE (
  rank bigint,
  total_ambassadors bigint,
  my_earned_thb numeric,
  above_earned_thb numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH monthly AS (
    SELECT
      rl.referrer_id,
      round(sum(rl.amount_thb)::numeric, 2) AS earned
    FROM public.referral_ledger rl
    WHERE rl.status = 'earned'
      AND rl.earned_at IS NOT NULL
      AND rl.earned_at >= p_period_start
      AND rl.earned_at < p_period_end_exclusive
    GROUP BY rl.referrer_id
  ),
  ranked AS (
    SELECT
      referrer_id,
      earned,
      row_number() OVER (ORDER BY earned DESC, referrer_id ASC) AS rn,
      count(*) OVER () AS total_cnt
    FROM monthly
  ),
  me AS (
    SELECT rn, earned, total_cnt
    FROM ranked
    WHERE referrer_id = p_user_id
  )
  SELECT
    CASE WHEN COALESCE(m.earned, 0) > 0 THEN m.rn ELSE NULL END::bigint AS rank,
    COALESCE(m.total_cnt, (SELECT count(*)::bigint FROM monthly), 0::bigint) AS total_ambassadors,
    COALESCE(m.earned, 0)::numeric AS my_earned_thb,
    (
      SELECT r.earned
      FROM ranked r
      WHERE r.rn = m.rn - 1
      LIMIT 1
    ) AS above_earned_thb
  FROM me m
  UNION ALL
  SELECT
    NULL::bigint AS rank,
    COALESCE((SELECT count(*)::bigint FROM monthly), 0::bigint) AS total_ambassadors,
    0::numeric AS my_earned_thb,
    NULL::numeric AS above_earned_thb
  WHERE NOT EXISTS (SELECT 1 FROM me)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.referral_user_rank_for_period(text, timestamptz, timestamptz) IS
  'Stage 202.30 — user monthly rank by earned referral_ledger in [start, end); mirrors leaderboard_for_period filters.';

GRANT EXECUTE ON FUNCTION public.referral_user_rank_for_period(text, timestamptz, timestamptz)
  TO service_role;
