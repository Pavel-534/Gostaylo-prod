-- Stage 100.6 — partner payout amounts in payout currency (RUB / USDT); ledger stays THB.

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS payout_currency TEXT,
  ADD COLUMN IF NOT EXISTS amount_in_payout_currency NUMERIC(14, 2);

COMMENT ON COLUMN public.payouts.payout_currency IS
  'Settlement currency for outbound transfer (RUB, USDT, THB). SSOT: lib/partner/partner-payout-fx.js';
COMMENT ON COLUMN public.payouts.amount_in_payout_currency IS
  'Amount partner receives in payout_currency; THB obligation remains in amount/gross_amount/final_amount.';

ALTER TABLE public.payout_batch_items
  ADD COLUMN IF NOT EXISTS amount_in_payout_currency NUMERIC(14, 2);

COMMENT ON COLUMN public.payout_batch_items.amount_in_payout_currency IS
  'Batch line payout amount in payout_currency; mirrors payouts.amount_in_payout_currency for registry export.';

-- Backfill: payouts.currency is enum currency_type — cast to text before TRIM/UPPER
UPDATE public.payouts
SET
  payout_currency = COALESCE(
    NULLIF(UPPER(TRIM(payout_currency::text)), ''),
    NULLIF(UPPER(TRIM(currency::text)), ''),
    'THB'
  ),
  amount_in_payout_currency = COALESCE(amount_in_payout_currency, final_amount, amount)
WHERE payout_currency IS NULL OR amount_in_payout_currency IS NULL;
