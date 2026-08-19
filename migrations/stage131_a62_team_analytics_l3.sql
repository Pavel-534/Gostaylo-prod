-- Stage 131.A6.2 — extend team analytics RPC with L3 split + per-level distinct counts.
--
-- l2_network_thb stays as L2+L3 sum (backward compat).
-- New columns: l3_network_thb, l1_distinct_count, l2_distinct_count, l3_distinct_count.

DROP FUNCTION IF EXISTS public.referral_team_analytics_for_referrer(text, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.referral_team_analytics_for_referrer(
  p_referrer_id text,
  p_period_start timestamptz,
  p_period_end_exclusive timestamptz
)
RETURNS TABLE (
  l1_direct_thb numeric,
  l2_network_thb numeric,
  l3_network_thb numeric,
  pending_thb numeric,
  held_thb numeric,
  guest_booking_thb numeric,
  host_activation_thb numeric,
  lifetime_earned_only_thb numeric,
  l1_distinct_count bigint,
  l2_distinct_count bigint,
  l3_distinct_count bigint
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
      rl.metadata,
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
      COALESCE(SUM(pe.amount_thb) FILTER (WHERE NOT pe.is_l1_direct), 0) AS l2_total_sum,
      COALESCE(SUM(pe.amount_thb) FILTER (
        WHERE NOT pe.is_l1_direct
          AND (pe.metadata->>'split_role') = 'l3_upline'
      ), 0) AS l3_sum,
      COALESCE(SUM(pe.amount_thb) FILTER (WHERE pe.referral_type = 'guest_booking'), 0) AS guest_sum,
      COALESCE(SUM(pe.amount_thb) FILTER (WHERE pe.referral_type = 'host_activation'), 0) AS host_sum,
      COUNT(DISTINCT pe.referee_id) FILTER (WHERE pe.is_l1_direct) AS l1_cnt,
      COUNT(DISTINCT pe.referee_id) FILTER (
        WHERE NOT pe.is_l1_direct
          AND COALESCE((pe.metadata->>'split_role'), '') <> 'l3_upline'
      ) AS l2_cnt,
      COUNT(DISTINCT pe.referee_id) FILTER (
        WHERE NOT pe.is_l1_direct
          AND (pe.metadata->>'split_role') = 'l3_upline'
      ) AS l3_cnt
    FROM period_earned pe
  )
  SELECT
    round((SELECT l1_sum FROM period_sums)::numeric, 2) AS l1_direct_thb,
    round((SELECT l2_total_sum FROM period_sums)::numeric, 2) AS l2_network_thb,
    round((SELECT l3_sum FROM period_sums)::numeric, 2) AS l3_network_thb,
    round((SELECT pending_sum FROM snapshot)::numeric, 2) AS pending_thb,
    round((SELECT held_sum FROM snapshot)::numeric, 2) AS held_thb,
    round((SELECT guest_sum FROM period_sums)::numeric, 2) AS guest_booking_thb,
    round((SELECT host_sum FROM period_sums)::numeric, 2) AS host_activation_thb,
    round((SELECT lifetime_earned_only FROM snapshot)::numeric, 2) AS lifetime_earned_only_thb,
    (SELECT l1_cnt FROM period_sums) AS l1_distinct_count,
    (SELECT l2_cnt FROM period_sums) AS l2_distinct_count,
    (SELECT l3_cnt FROM period_sums) AS l3_distinct_count;
$$;

COMMENT ON FUNCTION public.referral_team_analytics_for_referrer(text, timestamptz, timestamptz) IS
  'Stage 131.A6.2 — team KPI: L1 direct, L2 network (L2+L3 sum for compat), L3 by split_role=l3_upline, per-level distinct counts.';

GRANT EXECUTE ON FUNCTION public.referral_team_analytics_for_referrer(text, timestamptz, timestamptz)
  TO service_role;
