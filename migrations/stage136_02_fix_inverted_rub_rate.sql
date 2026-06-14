-- Emergency fix: inverted RUB rows (RUB/THB written into rate_to_thb by legacy smoke).
-- SSOT: rate_to_thb = THB per 1 RUB (typically 0.2–0.6).

UPDATE public.exchange_rates
SET
  rate_to_thb = round((1 / rate_to_thb)::numeric, 8),
  source = coalesce(source, 'manual') || '+inverted_rub_fix',
  updated_at = now()
WHERE currency_code = 'RUB'
  AND rate_to_thb > 1;
