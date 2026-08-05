-- Stage 200.33 / ADR-181 Wave 5.2 — seasonal L1 asset snapshot on seasonal_prices
-- price_daily / price_monthly remain THB ledger; metadata holds round-trip asset amounts.

ALTER TABLE public.seasonal_prices
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.seasonal_prices.metadata IS
  'ADR-181: price_daily_asset / price_monthly_asset snapshots {amount,currency,rate_thb_per_unit_mid,converted_at}';
