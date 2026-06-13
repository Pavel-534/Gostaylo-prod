-- Stage 133.0 — Team Analytics: indexes + RPC (L1/L2 «от меня», ADR-133).

CREATE INDEX IF NOT EXISTS idx_referral_ledger_analytics_core
  ON public.referral_ledger (referrer_id, status, earned_at DESC)
  WHERE status IN ('earned', 'earned_held');

CREATE INDEX IF NOT EXISTS idx_referral_relations_paginated
  ON public.referral_relations (referrer_id, referred_at DESC);

-- ── Period aggregates (earned + earned_held in window; pending/held = current snapshot) ──
CREATE OR REPLACE FUNCTION public.referral_team_analytics_for_referrer(
  p_referrer_id text,
  p_period_start timestamptz,
  p_period_end_exclusive timestamptz
)
RETURNS TABLE (
  l1_direct_thb numeric,
  l2_network_thb numeric,
  pending_thb numeric,
  held_thb numeric,
  guest_booking_thb numeric,
  host_activation_thb numeric,
  lifetime_earned_only_thb numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH direct_referees AS (
    SELECT rr.referee_id
    FROM public.referral_relations rr
    WHERE rr.referrer_id = p_referrer_id
  ),
  period_earned AS (
    SELECT
      rl.amount_thb,
      rl.referee_id,
      rl.referral_type,
      EXISTS (
        SELECT 1
        FROM direct_referees dr
        WHERE dr.referee_id = rl.referee_id
      ) AS is_l1_direct
    FROM public.referral_ledger rl
    WHERE rl.referrer_id = p_referrer_id
      AND rl.status IN ('earned', 'earned_held')
      AND COALESCE(rl.earned_at, rl.updated_at) >= p_period_start
      AND COALESCE(rl.earned_at, rl.updated_at) < p_period_end_exclusive
  ),
  snapshot AS (
    SELECT
      COALESCE(
        SUM(rl.amount_thb) FILTER (WHERE rl.status = 'pending'),
        0
      ) AS pending_sum,
      COALESCE(
        SUM(rl.amount_thb) FILTER (WHERE rl.status = 'earned_held'),
        0
      ) AS held_sum,
      COALESCE(
        SUM(rl.amount_thb) FILTER (WHERE rl.status = 'earned'),
        0
      ) AS lifetime_earned_only
    FROM public.referral_ledger rl
    WHERE rl.referrer_id = p_referrer_id
  ),
  period_sums AS (
    SELECT
      COALESCE(SUM(pe.amount_thb) FILTER (WHERE pe.is_l1_direct), 0) AS l1_sum,
      COALESCE(SUM(pe.amount_thb) FILTER (WHERE NOT pe.is_l1_direct), 0) AS l2_sum,
      COALESCE(SUM(pe.amount_thb) FILTER (WHERE pe.referral_type = 'guest_booking'), 0) AS guest_sum,
      COALESCE(SUM(pe.amount_thb) FILTER (WHERE pe.referral_type = 'host_activation'), 0) AS host_sum
    FROM period_earned pe
  )
  SELECT
    round((SELECT l1_sum FROM period_sums)::numeric, 2) AS l1_direct_thb,
    round((SELECT l2_sum FROM period_sums)::numeric, 2) AS l2_network_thb,
    round((SELECT pending_sum FROM snapshot)::numeric, 2) AS pending_thb,
    round((SELECT held_sum FROM snapshot)::numeric, 2) AS held_thb,
    round((SELECT guest_sum FROM period_sums)::numeric, 2) AS guest_booking_thb,
    round((SELECT host_sum FROM period_sums)::numeric, 2) AS host_activation_thb,
    round((SELECT lifetime_earned_only FROM snapshot)::numeric, 2) AS lifetime_earned_only_thb;
$$;

COMMENT ON FUNCTION public.referral_team_analytics_for_referrer(text, timestamptz, timestamptz) IS
  'Stage 133 — team KPI: L1 = direct referee_id in referral_relations; L2 = all other earned rows for referrer.';

GRANT EXECUTE ON FUNCTION public.referral_team_analytics_for_referrer(text, timestamptz, timestamptz)
  TO service_role;

-- ── Top contributors (lifetime earned + earned_held) ───────────────────────────
CREATE OR REPLACE FUNCTION public.referral_team_top_contributors_for_referrer(
  p_referrer_id text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (referee_id text, earned_thb numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    rl.referee_id,
    round(SUM(rl.amount_thb)::numeric, 2) AS earned_thb
  FROM public.referral_ledger rl
  WHERE rl.referrer_id = p_referrer_id
    AND rl.status IN ('earned', 'earned_held')
    AND rl.referee_id IS NOT NULL
  GROUP BY rl.referee_id
  ORDER BY earned_thb DESC
  LIMIT greatest(1, least(coalesce(nullif(p_limit, 0), 10), 50));
$$;

COMMENT ON FUNCTION public.referral_team_top_contributors_for_referrer(text, integer) IS
  'Stage 133 — top direct/network referees by lifetime credited THB for ambassador.';

GRANT EXECUTE ON FUNCTION public.referral_team_top_contributors_for_referrer(text, integer)
  TO service_role;
