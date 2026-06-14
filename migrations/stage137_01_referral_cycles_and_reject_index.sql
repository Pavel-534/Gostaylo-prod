-- Stage 137.1 — relation cycle detection RPC + reject audit index.

CREATE OR REPLACE FUNCTION public.stage137_detect_referral_cycles_rpc()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH cycles AS (
    SELECT rr.id, rr.referee_id
    FROM public.referral_relations rr
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(rr.ancestor_path, '[]'::jsonb)) elem
      WHERE elem = rr.referee_id
    )
  ),
  sample_rows AS (
    SELECT id, referee_id
    FROM cycles
    ORDER BY id
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'cycleCount', (SELECT count(*)::bigint FROM cycles),
    'cycleSample', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'refereeId', s.referee_id
          )
          ORDER BY s.id
        )
        FROM sample_rows s
      ),
      '[]'::jsonb
    )
  );
$$;

COMMENT ON FUNCTION public.stage137_detect_referral_cycles_rpc() IS
  'Stage 137.1 — count referral_relations where referee_id appears in ancestor_path; sample up to 5 rows.';

GRANT EXECUTE ON FUNCTION public.stage137_detect_referral_cycles_rpc() TO service_role;

CREATE INDEX IF NOT EXISTS idx_wallet_tx_referral_withdrawal_reject
  ON public.wallet_transactions (user_id, created_at DESC)
  WHERE tx_type = 'referral_withdrawal_reject';

COMMENT ON INDEX public.idx_wallet_tx_referral_withdrawal_reject IS
  'Stage 137.1 — admin reject audit rows (referral_withdrawal_reject).';
