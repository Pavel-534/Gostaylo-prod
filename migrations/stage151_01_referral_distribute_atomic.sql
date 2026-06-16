-- Stage 151.1 — Atomic referral ledger earn + wallet credit + bucket split (single TX).
-- SSOT: pending→earned + wallet_apply_operation + internal/withdrawable buckets.
-- Fraud gate / earned_held remain in Node (unchanged product behaviour).

CREATE OR REPLACE FUNCTION public.referral_distribute_bonus_atomic(
  p_ledger_id text,
  p_beneficiary_id text,
  p_amount_thb numeric,
  p_tx_type text,
  p_payout_to_internal_ratio numeric DEFAULT 0,
  p_earned_at timestamptz DEFAULT now(),
  p_unlock_at timestamptz DEFAULT NULL,
  p_metadata_patch jsonb DEFAULT '{}'::jsonb,
  p_wallet_metadata jsonb DEFAULT '{}'::jsonb,
  p_credit_only boolean DEFAULT false
)
RETURNS TABLE (
  applied boolean,
  reason text,
  ledger_id text,
  ledger_status text,
  wallet_applied boolean,
  wallet_reason text,
  transaction_id text,
  deficit_recovered_thb numeric,
  net_credit_thb numeric,
  internal_credits_delta_thb numeric,
  withdrawable_delta_thb numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_ledger_id text;
  v_ledger_status text;
  v_ledger_meta jsonb;
  v_beneficiary text;
  v_gross numeric(14, 2);
  v_net numeric(14, 2);
  v_deficit numeric(14, 2);
  v_recovered numeric(14, 2);
  v_tx_type text;
  v_ref_id text;
  v_internal numeric(14, 2);
  v_withdrawable numeric(14, 2);
  v_ratio numeric(14, 4);
  v_drift numeric(14, 2);
  v_wallet_id text;
  v_existing_tx_id text;
  v_op_applied boolean;
  v_op_reason text;
  v_op_tx_id text;
  v_wallet_meta jsonb;
  v_now timestamptz;
BEGIN
  v_now := coalesce(p_earned_at, now());
  v_ledger_id := trim(coalesce(p_ledger_id, ''));
  v_beneficiary := trim(coalesce(p_beneficiary_id, ''));
  v_gross := round(coalesce(p_amount_thb, 0)::numeric, 2);
  v_tx_type := lower(trim(coalesce(p_tx_type, 'referral_bonus')));
  v_ratio := greatest(0::numeric, least(100::numeric, coalesce(p_payout_to_internal_ratio, 0)::numeric));
  v_ref_id := 'referral_ledger:' || v_ledger_id;

  IF v_ledger_id = '' THEN
    RETURN QUERY SELECT false, 'LEDGER_ID_REQUIRED', NULL::text, NULL::text, false, NULL::text, NULL::text,
      0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;
  IF v_beneficiary = '' THEN
    RETURN QUERY SELECT false, 'BENEFICIARY_ID_REQUIRED', v_ledger_id, NULL::text, false, NULL::text, NULL::text,
      0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;
  IF v_gross <= 0 THEN
    RETURN QUERY SELECT false, 'AMOUNT_MUST_BE_POSITIVE', v_ledger_id, NULL::text, false, NULL::text, NULL::text,
      0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  SELECT rl.id, rl.status, coalesce(rl.metadata, '{}'::jsonb)
    INTO v_ledger_id, v_ledger_status, v_ledger_meta
  FROM public.referral_ledger rl
  WHERE rl.id = v_ledger_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'LEDGER_NOT_FOUND', p_ledger_id, NULL::text, false, NULL::text, NULL::text,
      0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  IF p_credit_only IS TRUE THEN
    IF lower(trim(v_ledger_status)) <> 'earned' THEN
      RETURN QUERY SELECT false, 'LEDGER_NOT_EARNED', v_ledger_id, v_ledger_status, false, NULL::text, NULL::text,
        0::numeric, 0::numeric, 0::numeric, 0::numeric;
      RETURN;
    END IF;
  ELSE
    IF lower(trim(v_ledger_status)) = 'earned' THEN
      SELECT wt.id
        INTO v_existing_tx_id
      FROM public.wallet_transactions wt
      WHERE wt.reference_id = v_ref_id
        AND wt.operation_type = 'credit'
      LIMIT 1;
      IF FOUND THEN
        RETURN QUERY SELECT true, 'ALREADY_EARNED', v_ledger_id, v_ledger_status, false, 'ALREADY_APPLIED',
          v_existing_tx_id, 0::numeric, 0::numeric, 0::numeric, 0::numeric;
        RETURN;
      END IF;
      -- earned without wallet tx — fall through to credit-only repair
    ELSIF lower(trim(v_ledger_status)) <> 'pending' THEN
      RETURN QUERY SELECT false, 'LEDGER_NOT_PENDING', v_ledger_id, v_ledger_status, false, NULL::text, NULL::text,
        0::numeric, 0::numeric, 0::numeric, 0::numeric;
      RETURN;
    ELSE
      UPDATE public.referral_ledger
      SET status = 'earned',
          earned_at = v_now,
          updated_at = v_now,
          unlock_at = p_unlock_at,
          metadata = v_ledger_meta || coalesce(p_metadata_patch, '{}'::jsonb)
      WHERE id = v_ledger_id
        AND status = 'pending';
      IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'LEDGER_EARN_RACE', v_ledger_id, v_ledger_status, false, NULL::text, NULL::text,
          0::numeric, 0::numeric, 0::numeric, 0::numeric;
        RETURN;
      END IF;
      v_ledger_status := 'earned';
    END IF;
  END IF;

  -- Idempotent wallet credit probe
  SELECT wt.id
    INTO v_existing_tx_id
  FROM public.wallet_transactions wt
  WHERE wt.reference_id = v_ref_id
    AND wt.operation_type = 'credit'
  LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT true, 'WALLET_ALREADY_APPLIED', v_ledger_id, v_ledger_status, false, 'ALREADY_APPLIED',
      v_existing_tx_id, 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  -- Deficit recovery (Stage 119.1 parity with WalletService.recoverReferralDeficitBeforeCredit)
  SELECT uw.id, coalesce(uw.referral_deficit_thb, 0)::numeric
    INTO v_wallet_id, v_deficit
  FROM public.user_wallets uw
  WHERE uw.user_id = v_beneficiary
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_wallets (id, user_id, balance_thb, currency, created_at, updated_at)
    VALUES (
      'wal-' || substring(md5(random()::text || clock_timestamp()::text), 1, 18),
      v_beneficiary,
      0,
      'THB',
      v_now,
      v_now
    );
    v_deficit := 0;
  ELSE
    v_deficit := round(greatest(0::numeric, v_deficit), 2);
  END IF;

  v_recovered := round(least(v_deficit, v_gross), 2);
  v_net := round(v_gross - v_recovered, 2);

  IF v_recovered > 0 THEN
    UPDATE public.user_wallets
    SET referral_deficit_thb = round(greatest(0::numeric, v_deficit - v_recovered), 2),
        updated_at = v_now
    WHERE user_id = v_beneficiary;
  END IF;

  IF v_net <= 0 THEN
    RETURN QUERY SELECT true, 'CREDIT_APPLIED_TO_DEFICIT', v_ledger_id, v_ledger_status, false,
      'CREDIT_APPLIED_TO_DEFICIT', NULL::text, v_recovered, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  IF v_tx_type IN (
    'referral_bonus',
    'referral_bonus_withdrawable',
    'referral_bonus_internal',
    'referral_bonus_host_activation',
    'referral_bonus_supply'
  ) THEN
    v_withdrawable := round(v_net * (v_ratio / 100::numeric), 2);
    v_internal := round(v_net - v_withdrawable, 2);
    v_drift := round(v_net - (v_internal + v_withdrawable), 2);
    IF abs(v_drift) > 0 THEN
      v_withdrawable := round(v_withdrawable + v_drift, 2);
    END IF;
  ELSE
    v_internal := v_net;
    v_withdrawable := 0;
  END IF;

  v_wallet_meta := coalesce(p_wallet_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'retention_split',
      jsonb_build_object(
        'payout_to_internal_ratio', v_ratio,
        'internal_credits_part_thb', v_internal,
        'withdrawable_part_thb', v_withdrawable
      )
    );
  IF v_recovered > 0 THEN
    v_wallet_meta := v_wallet_meta || jsonb_build_object('referral_deficit_recovered_thb', v_recovered);
  END IF;

  SELECT w.applied, w.reason, w.transaction_id
    INTO v_op_applied, v_op_reason, v_op_tx_id
  FROM public.wallet_apply_operation(
    v_beneficiary,
    v_net,
    'credit',
    v_tx_type,
    v_ref_id,
    v_wallet_meta,
    NULL::timestamptz
  ) AS w(applied, reason, wallet_id, balance_before_thb, balance_after_thb, transaction_id)
  LIMIT 1;

  IF coalesce(v_op_applied, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'REFERRAL_WALLET_CREDIT_FAILED:%', coalesce(v_op_reason, 'UNKNOWN');
  END IF;

  UPDATE public.user_wallets
  SET internal_credits_thb = round(
        greatest(0::numeric, coalesce(internal_credits_thb, 0)::numeric + v_internal),
        2
      ),
      withdrawable_balance_thb = round(
        greatest(0::numeric, coalesce(withdrawable_balance_thb, 0)::numeric + v_withdrawable),
        2
      ),
      updated_at = v_now
  WHERE user_id = v_beneficiary;

  RETURN QUERY SELECT true, 'APPLIED', v_ledger_id, 'earned'::text, true, 'APPLIED',
    v_op_tx_id, v_recovered, v_net, v_internal, v_withdrawable;
END;
$$;

COMMENT ON FUNCTION public.referral_distribute_bonus_atomic(
  text, text, numeric, text, numeric, timestamptz, timestamptz, jsonb, jsonb, boolean
) IS
  'Stage 151.1 — FOR UPDATE ledger earn (pending→earned) + wallet_apply_operation + bucket split in one TX. credit_only=true for unlock/repair.';

GRANT EXECUTE ON FUNCTION public.referral_distribute_bonus_atomic(
  text, text, numeric, text, numeric, timestamptz, timestamptz, jsonb, jsonb, boolean
) TO service_role;
