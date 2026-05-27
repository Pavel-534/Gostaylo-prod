-- Stage 119.1 — Referral financial lock: canceled_deficit, promo tank reversals, wallet deficit.

-- ── referral_ledger: deficit terminal status ───────────────────────────────────
ALTER TABLE public.referral_ledger
  DROP CONSTRAINT IF EXISTS referral_ledger_status_check;

ALTER TABLE public.referral_ledger
  ADD CONSTRAINT referral_ledger_status_check CHECK (
    status IN ('pending', 'earned', 'canceled', 'canceled_deficit')
  );

COMMENT ON COLUMN public.referral_ledger.status IS
  'pending | earned | canceled | canceled_deficit (wallet clawback shortfall; metadata.deficit_thb).';

-- ── marketing promo tank: reversal entry types (idempotent per booking_id) ───
ALTER TABLE public.marketing_promo_tank_ledger
  DROP CONSTRAINT IF EXISTS marketing_promo_tank_ledger_entry_type_check;

ALTER TABLE public.marketing_promo_tank_ledger
  ADD CONSTRAINT marketing_promo_tank_ledger_entry_type_check CHECK (
    entry_type IN (
      'organic_topup',
      'referral_boost_debit',
      'referral_boost_reversal',
      'manual_topup',
      'manual_debit',
      'welcome_bonus_return',
      'host_activation_bonus_debit',
      'host_activation_reversal'
    )
  );

-- ── user_wallets: referral deficit tracking (auto-recovery on next credit) ───
ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS referral_deficit_thb NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (referral_deficit_thb >= 0);

COMMENT ON COLUMN public.user_wallets.referral_deficit_thb IS
  'Stage 119.1 — непогашенный долг после referral clawback при INSUFFICIENT_FUNDS; гасится следующими referral/welcome credits.';

-- ── wallet_apply_operation: allow referral_clawback deficit when flagged ─────
CREATE OR REPLACE FUNCTION public.wallet_apply_operation(
  p_user_id text,
  p_amount_thb numeric,
  p_operation_type text,
  p_tx_type text,
  p_reference_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  applied boolean,
  reason text,
  wallet_id text,
  balance_before_thb numeric,
  balance_after_thb numeric,
  transaction_id text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id text;
  v_balance numeric(14,2);
  v_amount numeric(14,2);
  v_operation text;
  v_now timestamptz;
  v_existing_tx text;
  v_tx_type text;
  v_allow_deficit boolean;
BEGIN
  v_now := now();
  v_amount := round(coalesce(p_amount_thb, 0)::numeric, 2);
  v_operation := lower(trim(coalesce(p_operation_type, '')));
  v_tx_type := lower(trim(coalesce(p_tx_type, '')));
  v_allow_deficit := coalesce(p_metadata, '{}'::jsonb) ->> 'allow_deficit' = 'true'
    AND v_tx_type = 'referral_clawback'
    AND v_operation = 'debit';

  IF coalesce(trim(p_user_id), '') = '' THEN
    RETURN QUERY SELECT false, 'USER_ID_REQUIRED', NULL::text, 0::numeric, 0::numeric, NULL::text;
    RETURN;
  END IF;
  IF v_amount <= 0 THEN
    RETURN QUERY SELECT false, 'AMOUNT_MUST_BE_POSITIVE', NULL::text, 0::numeric, 0::numeric, NULL::text;
    RETURN;
  END IF;
  IF v_operation NOT IN ('credit', 'debit') THEN
    RETURN QUERY SELECT false, 'INVALID_OPERATION_TYPE', NULL::text, 0::numeric, 0::numeric, NULL::text;
    RETURN;
  END IF;

  IF p_reference_id IS NOT NULL THEN
    SELECT id
      INTO v_existing_tx
    FROM public.wallet_transactions
    WHERE reference_id = p_reference_id
      AND operation_type = v_operation
    LIMIT 1;
    IF v_existing_tx IS NOT NULL THEN
      SELECT uw.id, uw.balance_thb
        INTO v_wallet_id, v_balance
      FROM public.user_wallets uw
      WHERE uw.user_id = p_user_id
      LIMIT 1;
      RETURN QUERY SELECT false, 'ALREADY_APPLIED', v_wallet_id, v_balance, v_balance, v_existing_tx;
      RETURN;
    END IF;
  END IF;

  SELECT id, balance_thb
    INTO v_wallet_id, v_balance
  FROM public.user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    v_wallet_id := 'wal-' || substring(md5(random()::text || clock_timestamp()::text), 1, 18);
    INSERT INTO public.user_wallets (id, user_id, balance_thb, currency, created_at, updated_at)
    VALUES (v_wallet_id, p_user_id, 0, 'THB', v_now, v_now);
    v_balance := 0;
  END IF;

  IF v_operation = 'debit' AND (v_balance - v_amount) < 0 AND NOT v_allow_deficit THEN
    RETURN QUERY SELECT false, 'INSUFFICIENT_FUNDS', v_wallet_id, v_balance, v_balance, NULL::text;
    RETURN;
  END IF;

  UPDATE public.user_wallets
  SET balance_thb = CASE
      WHEN v_operation = 'credit' THEN round((balance_thb + v_amount)::numeric, 2)
      ELSE round((balance_thb - v_amount)::numeric, 2)
    END,
    referral_deficit_thb = CASE
      WHEN v_allow_deficit AND v_operation = 'debit' AND (v_balance - v_amount) < 0 THEN
        round(
          coalesce(referral_deficit_thb, 0)::numeric
          + greatest(0::numeric, round((v_amount - v_balance)::numeric, 2)),
          2
        )
      ELSE referral_deficit_thb
    END,
    updated_at = v_now
  WHERE id = v_wallet_id
  RETURNING balance_thb INTO v_balance;

  INSERT INTO public.wallet_transactions (
    id,
    wallet_id,
    user_id,
    operation_type,
    amount_thb,
    balance_before_thb,
    balance_after_thb,
    tx_type,
    reference_id,
    metadata,
    expires_at,
    created_at
  )
  VALUES (
    'wtx-' || substring(md5(random()::text || clock_timestamp()::text), 1, 18),
    v_wallet_id,
    p_user_id,
    v_operation,
    v_amount,
    CASE
      WHEN v_operation = 'credit' THEN round((v_balance - v_amount)::numeric, 2)
      ELSE round((v_balance + v_amount)::numeric, 2)
    END,
    v_balance,
    coalesce(trim(p_tx_type), 'wallet_operation'),
    p_reference_id,
    coalesce(p_metadata, '{}'::jsonb),
    CASE WHEN v_operation = 'credit' THEN p_expires_at ELSE NULL END,
    v_now
  )
  RETURNING id INTO v_existing_tx;

  RETURN QUERY
    SELECT true, 'APPLIED', v_wallet_id,
      CASE
        WHEN v_operation = 'credit' THEN round((v_balance - v_amount)::numeric, 2)
        ELSE round((v_balance + v_amount)::numeric, 2)
      END,
      v_balance,
      v_existing_tx;
END;
$$;
