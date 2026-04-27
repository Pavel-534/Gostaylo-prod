-- Stage 71.5 — Wallet core + atomic wallet operations.

CREATE TABLE IF NOT EXISTS public.user_wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  balance_thb NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance_thb >= 0),
  currency TEXT NOT NULL DEFAULT 'THB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_wallets_user_id_key UNIQUE (user_id),
  CONSTRAINT user_wallets_currency_chk CHECK (currency IN ('THB'))
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES public.user_wallets (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('credit', 'debit')),
  amount_thb NUMERIC(14, 2) NOT NULL CHECK (amount_thb > 0),
  balance_before_thb NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance_before_thb >= 0),
  balance_after_thb NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance_after_thb >= 0),
  tx_type TEXT NOT NULL,
  reference_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
  ON public.wallet_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference
  ON public.wallet_transactions (reference_id)
  WHERE reference_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_transactions_reference_operation
  ON public.wallet_transactions (reference_id, operation_type)
  WHERE reference_id IS NOT NULL;

COMMENT ON TABLE public.user_wallets IS
  'Virtual user wallet for referral/marketing credits; payout-ready module.';
COMMENT ON TABLE public.wallet_transactions IS
  'Immutable wallet ledger for credits/debits.';

UPDATE public.system_settings
SET value =
  coalesce(value, '{}'::jsonb)
  || jsonb_build_object(
    'welcome_bonus_amount',
      coalesce((value ->> 'welcome_bonus_amount')::numeric, 0),
    'wallet_max_discount_percent',
      coalesce((value ->> 'wallet_max_discount_percent')::numeric, 30),
    'referral_boost_allocation_rule',
      coalesce(value ->> 'referral_boost_allocation_rule', 'split_50_50')
  ),
  updated_at = now()
WHERE key = 'general';

CREATE OR REPLACE FUNCTION public.wallet_apply_operation(
  p_user_id text,
  p_amount_thb numeric,
  p_operation_type text,
  p_tx_type text,
  p_reference_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
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
    id, wallet_id, user_id, operation_type, amount_thb, balance_before_thb, balance_after_thb, tx_type, reference_id, metadata, created_at
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

