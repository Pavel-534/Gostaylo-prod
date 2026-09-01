-- Stage 202.25 — Insurance fund % SSOT in system_fintech_settings (was hardcoded 0.5% in waterfall preview).
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.system_fintech_settings
  ADD COLUMN IF NOT EXISTS insurance_fund_percent NUMERIC(8, 4) NOT NULL DEFAULT 0.5;

COMMENT ON COLUMN public.system_fintech_settings.insurance_fund_percent IS
  'Stage 202.25 — % of platform gross margin (guest fee + host commission) reserved for insurance fund.';

-- One-time: prefer legacy general.insuranceFundPercent when present (keeps prod parity).
UPDATE public.system_fintech_settings AS s
SET insurance_fund_percent = COALESCE(
  (
    SELECT NULLIF(TRIM(ss.value->>'insuranceFundPercent'), '')::NUMERIC
    FROM public.system_settings AS ss
    WHERE ss.key = 'general'
    LIMIT 1
  ),
  s.insurance_fund_percent,
  0.5
)
WHERE s.id = 'global';
