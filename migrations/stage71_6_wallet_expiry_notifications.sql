-- Stage 71.6 — Wallet expiry fields, welcome-bonus tracking, promo-tank welcome return entry type.

-- Ledger: credits may carry expires_at (e.g. promotional welcome credits).
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.wallet_transactions.expires_at IS
  'Optional expiry for time-limited credits (NULL = non-expiring).';

-- Balance slice for welcome bonus (FIFO against wallet spends in app layer).
ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS welcome_bonus_remaining_thb NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (welcome_bonus_remaining_thb >= 0),
  ADD COLUMN IF NOT EXISTS welcome_bonus_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS welcome_notify_5d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS welcome_notify_1d_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_wallets.welcome_bonus_remaining_thb IS
  'Portion of balance still attributed to welcome bonus grant (decays on spend).';
COMMENT ON COLUMN public.user_wallets.welcome_bonus_expires_at IS
  'When unused welcome slice is forfeited back to marketing promo tank.';

CREATE INDEX IF NOT EXISTS idx_user_wallets_welcome_expires
  ON public.user_wallets (welcome_bonus_expires_at)
  WHERE welcome_bonus_expires_at IS NOT NULL AND welcome_bonus_remaining_thb > 0;

-- Promo tank ledger: allow returning forfeited welcome funds.
ALTER TABLE public.marketing_promo_tank_ledger DROP CONSTRAINT IF EXISTS marketing_promo_tank_ledger_entry_type_check;

ALTER TABLE public.marketing_promo_tank_ledger ADD CONSTRAINT marketing_promo_tank_ledger_entry_type_check CHECK (
  entry_type IN (
    'organic_topup',
    'referral_boost_debit',
    'manual_topup',
    'manual_debit',
    'welcome_bonus_return'
  )
);

-- wallet_apply_operation: optional expires_at on ledger row (credits mainly).
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
BEGIN
  v_now := now();
  v_amount := round(coalesce(p_amount_thb, 0)::numeric, 2);
  v_operation := lower(trim(coalesce(p_operation_type, '')));

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

  IF v_operation = 'debit' AND (v_balance - v_amount) < 0 THEN
    RETURN QUERY SELECT false, 'INSUFFICIENT_FUNDS', v_wallet_id, v_balance, v_balance, NULL::text;
    RETURN;
  END IF;

  UPDATE public.user_wallets
  SET balance_thb = CASE
      WHEN v_operation = 'credit' THEN round((balance_thb + v_amount)::numeric, 2)
      ELSE round((balance_thb - v_amount)::numeric, 2)
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
    CASE WHEN v_operation = 'credit' THEN round((v_balance - v_amount)::numeric, 2) ELSE round((v_balance + v_amount)::numeric, 2) END,
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
      CASE WHEN v_operation = 'credit' THEN round((v_balance - v_amount)::numeric, 2) ELSE round((v_balance + v_amount)::numeric, 2) END,
      v_balance,
      v_existing_tx;
END;
$$;
