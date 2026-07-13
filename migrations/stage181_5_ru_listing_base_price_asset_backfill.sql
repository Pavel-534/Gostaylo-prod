-- Stage 181.5 — RU listings: backfill metadata.base_price_asset (ADR-181 Wave 5)
-- Prerequisite: exchange_rates row for RUB (rate_to_thb = THB per 1 RUB, semantic < 1).
-- Idempotent: only rows missing metadata.base_price_asset.amount are updated.
-- Does NOT change base_price_thb (assumes column already holds THB canon).

BEGIN;

-- ── 0) Dry-run preview (uncomment before production UPDATE) ───────────────────
-- SELECT
--   l.id,
--   l.country_code,
--   l.region_code,
--   l.base_currency,
--   l.base_price_thb,
--   er.rate_to_thb AS raw_rub_rate,
--   CASE
--     WHEN er.rate_to_thb IS NULL OR er.rate_to_thb <= 0 THEN NULL
--     WHEN er.currency_code = 'RUB' AND er.rate_to_thb > 1 THEN round((1 / er.rate_to_thb)::numeric, 8)
--     ELSE er.rate_to_thb
--   END AS thb_per_rub,
--   CASE
--     WHEN er.rate_to_thb IS NULL OR er.rate_to_thb <= 0 THEN NULL
--     ELSE round(
--       (l.base_price_thb::numeric) / (
--         CASE
--           WHEN er.currency_code = 'RUB' AND er.rate_to_thb > 1 THEN (1 / er.rate_to_thb)::numeric
--           ELSE er.rate_to_thb
--         END
--       ),
--       2
--     )
--   END AS derived_asset_amount_rub
-- FROM public.listings l
-- LEFT JOIN public.exchange_rates er ON er.currency_code = 'RUB'
-- WHERE (
--     upper(trim(coalesce(l.country_code, ''))) = 'RU'
--     OR upper(trim(coalesce(l.region_code, ''))) LIKE 'RU-%'
--   )
--   AND COALESCE(l.base_price_thb, 0) > 0
--   AND (l.metadata->'base_price_asset'->>'amount') IS NULL;

-- ── 1) Guard: RUB mid rate must exist ─────────────────────────────────────────
DO $$
DECLARE
  v_rate numeric;
BEGIN
  SELECT
    CASE
      WHEN rate_to_thb IS NULL OR rate_to_thb <= 0 THEN NULL
      WHEN currency_code = 'RUB' AND rate_to_thb > 1 THEN round((1 / rate_to_thb)::numeric, 8)
      ELSE rate_to_thb
    END
  INTO v_rate
  FROM public.exchange_rates
  WHERE currency_code = 'RUB'
  LIMIT 1;

  IF v_rate IS NULL OR v_rate <= 0 THEN
    RAISE EXCEPTION 'stage181_5_backfill_blocked: missing or invalid RUB rate_to_thb in exchange_rates';
  END IF;
END $$;

-- ── 2) Backfill metadata.base_price_asset ───────────────────────────────────
WITH rub_rate AS (
  SELECT
    CASE
      WHEN rate_to_thb IS NULL OR rate_to_thb <= 0 THEN NULL::numeric
      WHEN currency_code = 'RUB' AND rate_to_thb > 1 THEN round((1 / rate_to_thb)::numeric, 8)
      ELSE rate_to_thb
    END AS thb_per_rub
  FROM public.exchange_rates
  WHERE currency_code = 'RUB'
  LIMIT 1
),
candidates AS (
  SELECT
    l.id,
    l.base_price_thb,
    r.thb_per_rub,
    round((l.base_price_thb::numeric / r.thb_per_rub)::numeric, 2) AS asset_amount_rub
  FROM public.listings l
  CROSS JOIN rub_rate r
  WHERE (
      upper(trim(coalesce(l.country_code, ''))) = 'RU'
      OR upper(trim(coalesce(l.region_code, ''))) LIKE 'RU-%'
    )
    AND COALESCE(l.base_price_thb, 0) > 0
    AND (l.metadata->'base_price_asset'->>'amount') IS NULL
    AND r.thb_per_rub IS NOT NULL
    AND r.thb_per_rub > 0
)
UPDATE public.listings AS l
SET
  base_currency = 'RUB',
  metadata = jsonb_set(
    jsonb_set(
      COALESCE(l.metadata, '{}'::jsonb),
      '{base_price_asset}',
      jsonb_build_object(
        'amount', c.asset_amount_rub,
        'currency', 'RUB',
        'rate_thb_per_unit_mid', c.thb_per_rub,
        'converted_at', to_jsonb(now()::timestamptz),
        'source', 'backfill_stage181_5'
      ),
      true
    ),
    '{base_price_backfill_assumed}',
    'true'::jsonb,
    true
  ),
  updated_at = NOW()
FROM candidates c
WHERE l.id = c.id;

-- ── 3) Post-check ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_remaining bigint;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM public.listings l
  WHERE (
      upper(trim(coalesce(l.country_code, ''))) = 'RU'
      OR upper(trim(coalesce(l.region_code, ''))) LIKE 'RU-%'
    )
    AND COALESCE(l.base_price_thb, 0) > 0
    AND (l.metadata->'base_price_asset'->>'amount') IS NULL;

  RAISE NOTICE 'stage181_5: RU listings still missing base_price_asset.amount = %', v_remaining;
END $$;

COMMIT;
