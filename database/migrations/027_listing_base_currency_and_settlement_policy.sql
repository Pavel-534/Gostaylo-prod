-- Financial Module 3.0 — Phase 1.1
-- Canonical listing base currency + settlement policy defaults.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS base_currency currency_type DEFAULT 'THB';

UPDATE public.listings
SET base_currency = CASE
  WHEN UPPER(COALESCE(metadata->>'base_currency', '')) IN ('THB', 'RUB', 'USD', 'USDT')
    THEN UPPER(metadata->>'base_currency')::currency_type
  ELSE 'THB'::currency_type
END
WHERE base_currency IS NULL;

COMMENT ON COLUMN public.listings.base_currency IS
  'Listing base currency used to decide checkout markup (same currency => no retail spread).';

-- Optional policy defaults for payout timing (EscrowService reads these keys).
-- Can be changed in admin settings via system_settings.general.
UPDATE public.system_settings
SET value = jsonb_set(
      jsonb_set(
        COALESCE(value, '{}'::jsonb),
        '{settlementPayoutDelayDays}',
        COALESCE(value->'settlementPayoutDelayDays', '1'::jsonb),
        true
      ),
      '{settlementPayoutHourLocal}',
      COALESCE(value->'settlementPayoutHourLocal', '18'::jsonb),
      true
    ),
    updated_at = NOW()
WHERE key = 'general';
