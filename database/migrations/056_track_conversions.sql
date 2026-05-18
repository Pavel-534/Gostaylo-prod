-- Stage 101 — track real treasury conversions and FX losses.
-- Adds conversion trace fields on ledger_entries and seeds a dedicated loss account.

ALTER TABLE public.ledger_entries
  ADD COLUMN IF NOT EXISTS conversion_from_currency TEXT,
  ADD COLUMN IF NOT EXISTS conversion_to_currency TEXT,
  ADD COLUMN IF NOT EXISTS conversion_rate_used NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS conversion_fee_thb NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS conversion_fee_rub NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS external_tx_reference TEXT,
  ADD COLUMN IF NOT EXISTS conversion_loss_thb NUMERIC(14, 2);

COMMENT ON COLUMN public.ledger_entries.conversion_from_currency IS
  'Treasury conversion source currency (RUB, KGS, USDT, THB, etc).';
COMMENT ON COLUMN public.ledger_entries.conversion_to_currency IS
  'Treasury conversion target currency (RUB, KGS, USDT, THB, etc).';
COMMENT ON COLUMN public.ledger_entries.conversion_rate_used IS
  'Fact rate used in conversion operation (to_currency per 1 from_currency).';
COMMENT ON COLUMN public.ledger_entries.conversion_fee_thb IS
  'Operational conversion fee translated to THB.';
COMMENT ON COLUMN public.ledger_entries.conversion_fee_rub IS
  'Operational conversion fee in RUB (for bank paperwork).';
COMMENT ON COLUMN public.ledger_entries.external_tx_reference IS
  'External bank/crypto transaction reference (tx hash / bank operation id).';
COMMENT ON COLUMN public.ledger_entries.conversion_loss_thb IS
  'Realized loss from treasury conversion in THB (spread/slippage/fee impact).';

INSERT INTO public.ledger_accounts (
  id,
  code,
  display_name,
  account_type
)
VALUES (
  'la-sys-fx-conversion-losses',
  'FX_CONVERSION_LOSSES',
  'Treasury FX conversion losses',
  'SYSTEM'
)
ON CONFLICT (id) DO NOTHING;
