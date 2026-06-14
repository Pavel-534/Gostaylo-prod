-- Stage 136.1 — semantic guard: RUB rate_to_thb = THB per 1 RUB (must be < 1).

ALTER TABLE public.exchange_rates
  DROP CONSTRAINT IF EXISTS chk_rub_rate_semantic;

ALTER TABLE public.exchange_rates
  ADD CONSTRAINT chk_rub_rate_semantic
  CHECK (currency_code != 'RUB' OR rate_to_thb < 1.0);

COMMENT ON CONSTRAINT chk_rub_rate_semantic ON public.exchange_rates IS
  'Stage 136.1 — block inverted RUB/THB pairs in rate_to_thb (THB per 1 RUB only).';
