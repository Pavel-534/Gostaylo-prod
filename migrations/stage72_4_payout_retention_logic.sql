-- Stage 72.4 — Hybrid retention wallet split (internal credits + withdrawable balance).

ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS internal_credits_thb NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawable_balance_thb NUMERIC(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.user_wallets.internal_credits_thb IS
  'Balance available for internal platform spend only (checkout/fees), not direct payout.';
COMMENT ON COLUMN public.user_wallets.withdrawable_balance_thb IS
  'Balance eligible for payout workflow (subject to verification + threshold gates).';

UPDATE public.user_wallets
SET
  internal_credits_thb = GREATEST(0, COALESCE(balance_thb, 0)),
  withdrawable_balance_thb = 0
WHERE COALESCE(internal_credits_thb, 0) = 0
  AND COALESCE(withdrawable_balance_thb, 0) = 0
  AND COALESCE(balance_thb, 0) > 0;

UPDATE public.system_settings
SET value =
  jsonb_set(
    coalesce(value, '{}'::jsonb),
    '{payout_to_internal_ratio}',
    to_jsonb(
      coalesce(
        nullif(trim(coalesce(value ->> 'payout_to_internal_ratio', '')), '')::numeric,
        70
      )
    ),
    true
  ),
  updated_at = now()
WHERE key = 'general';

