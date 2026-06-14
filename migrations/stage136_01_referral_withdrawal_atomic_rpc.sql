-- Stage 136 — Atomic referral withdrawal request (FOR UPDATE) + immutable rate-limit log + host retention RPC.

-- ── wallet_transactions: audit rows (no balance mutation) for withdrawal requests ──
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_operation_type_check;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_operation_type_check
  CHECK (operation_type IN ('credit', 'debit', 'audit'));

COMMENT ON COLUMN public.wallet_transactions.operation_type IS
  'credit/debit — balance mutation via wallet_apply_operation; audit — immutable event log (balance unchanged).';

CREATE INDEX IF NOT EXISTS idx_wallet_tx_referral_withdrawal_request_rate
  ON public.wallet_transactions (user_id, created_at DESC)
  WHERE tx_type = 'referral_withdrawal_request';

-- ── bookings: retention EXISTS probe ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_partner_completed
  ON public.bookings (partner_id)
  WHERE status = 'COMPLETED';

-- ── Atomic withdrawal request (P0 concurrency + rate limit) ─────────────────────
CREATE OR REPLACE FUNCTION public.referral_request_withdrawal_atomic(
  p_user_id text,
  p_amount_thb numeric,
  p_requested_at timestamptz DEFAULT now(),
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_rate_limit_max integer DEFAULT 5,
  p_rate_limit_days integer DEFAULT 30
)
RETURNS TABLE (
  applied boolean,
  reason text,
  wallet_id text,
  referral_withdrawal_status text,
  referral_withdrawal_requested_at timestamptz,
  referral_withdrawal_amount_thb numeric,
  referral_withdrawal_metadata jsonb,
  transaction_id text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id text;
  v_balance numeric(14, 2);
  v_amount numeric(14, 2);
  v_now timestamptz;
  v_status text;
  v_existing_requested_at timestamptz;
  v_existing_amount numeric(14, 2);
  v_existing_metadata jsonb;
  v_request_count bigint;
  v_tx_id text;
  v_ref_id text;
BEGIN
  v_now := coalesce(p_requested_at, now());
  v_amount := round(coalesce(p_amount_thb, 0)::numeric, 2);

  IF coalesce(trim(p_user_id), '') = '' THEN
    RETURN QUERY SELECT false, 'USER_ID_REQUIRED', NULL::text, NULL::text, NULL::timestamptz, NULL::numeric, NULL::jsonb, NULL::text;
    RETURN;
  END IF;

  IF v_amount <= 0 THEN
    RETURN QUERY SELECT false, 'INVALID_AMOUNT', NULL::text, NULL::text, NULL::timestamptz, NULL::numeric, NULL::jsonb, NULL::text;
    RETURN;
  END IF;

  SELECT uw.id, uw.balance_thb, uw.referral_withdrawal_status,
         uw.referral_withdrawal_requested_at, uw.referral_withdrawal_amount_thb,
         uw.referral_withdrawal_metadata
    INTO v_wallet_id, v_balance, v_status, v_existing_requested_at, v_existing_amount, v_existing_metadata
  FROM public.user_wallets uw
  WHERE uw.user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN QUERY SELECT false, 'WALLET_NOT_FOUND', NULL::text, NULL::text, NULL::timestamptz, NULL::numeric, NULL::jsonb, NULL::text;
    RETURN;
  END IF;

  IF v_status = 'withdrawable_referral' THEN
    RETURN QUERY SELECT false, 'ALREADY_REQUESTED', v_wallet_id, v_status,
      v_existing_requested_at, v_existing_amount, v_existing_metadata, NULL::text;
    RETURN;
  END IF;

  SELECT count(*)::bigint
    INTO v_request_count
  FROM public.wallet_transactions wt
  WHERE wt.user_id = p_user_id
    AND wt.tx_type = 'referral_withdrawal_request'
    AND wt.created_at >= (v_now - make_interval(days => greatest(coalesce(p_rate_limit_days, 30), 1)));

  IF v_request_count >= greatest(coalesce(p_rate_limit_max, 5), 1) THEN
    RETURN QUERY SELECT false, 'REFERRAL_WITHDRAWAL_RATE_LIMIT', v_wallet_id, v_status,
      v_existing_requested_at, v_existing_amount, v_existing_metadata, NULL::text;
    RETURN;
  END IF;

  UPDATE public.user_wallets
  SET referral_withdrawal_status = 'withdrawable_referral',
      referral_withdrawal_requested_at = v_now,
      referral_withdrawal_amount_thb = v_amount,
      referral_withdrawal_metadata = coalesce(p_metadata, '{}'::jsonb),
      updated_at = v_now
  WHERE id = v_wallet_id;

  v_ref_id := 'referral_withdrawal_request:' || p_user_id || ':' || to_char(v_now, 'YYYYMMDDHH24MISSMS');

  v_tx_id := 'wtx-' || substring(md5(random()::text || clock_timestamp()::text), 1, 18);

  INSERT INTO public.wallet_transactions (
    id, wallet_id, user_id, operation_type, amount_thb,
    balance_before_thb, balance_after_thb, tx_type, reference_id, metadata, created_at
  )
  VALUES (
    v_tx_id,
    v_wallet_id,
    p_user_id,
    'audit',
    v_amount,
    v_balance,
    v_balance,
    'referral_withdrawal_request',
    v_ref_id,
    coalesce(p_metadata, '{}'::jsonb),
    v_now
  );

  RETURN QUERY SELECT true, 'APPLIED', v_wallet_id, 'withdrawable_referral'::text,
    v_now, v_amount, coalesce(p_metadata, '{}'::jsonb), v_tx_id;
END;
$$;

COMMENT ON FUNCTION public.referral_request_withdrawal_atomic(text, numeric, timestamptz, jsonb, integer, integer) IS
  'Stage 136 — FOR UPDATE withdrawal queue + immutable rate-limit log (wallet_transactions.referral_withdrawal_request).';

GRANT EXECUTE ON FUNCTION public.referral_request_withdrawal_atomic(text, numeric, timestamptz, jsonb, integer, integer)
  TO service_role;

-- ── Host retention (P1 — SQL EXISTS, no Node bulk load) ────────────────────────
CREATE OR REPLACE FUNCTION public.referral_host_retention_for_referrer(p_referrer_id text)
RETURNS TABLE (
  rate_percent numeric,
  numerator bigint,
  denominator bigint,
  definition text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH direct_partners AS (
    SELECT rr.referee_id
    FROM public.referral_relations rr
    INNER JOIN public.profiles p ON p.id = rr.referee_id
    WHERE rr.referrer_id = p_referrer_id
      AND p.role::text = 'PARTNER'
  ),
  counts AS (
    SELECT
      count(*)::bigint AS denom,
      count(*) FILTER (
        WHERE EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.partner_id = direct_partners.referee_id
            AND b.status = 'COMPLETED'
        )
      )::bigint AS num
    FROM direct_partners
  )
  SELECT
    round(
      (CASE WHEN c.denom > 0 THEN (c.num::numeric / c.denom::numeric) * 100 ELSE 0 END)::numeric,
      1
    ) AS rate_percent,
    c.num AS numerator,
    c.denom AS denominator,
    'direct_partners_with_completed_host_booking'::text AS definition
  FROM counts c;
$$;

COMMENT ON FUNCTION public.referral_host_retention_for_referrer(text) IS
  'Stage 136 — host retention: share of direct PARTNER referees with ≥1 COMPLETED booking.';

GRANT EXECUTE ON FUNCTION public.referral_host_retention_for_referrer(text)
  TO service_role;
