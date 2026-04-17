-- Financial Module 3.0 — Phase 1 schema alignment
-- Keep compatibility with existing production data (TEXT ids, Supabase public schema).

DO $$
BEGIN
  CREATE TYPE preferred_payout_currency_type AS ENUM ('RUB', 'THB', 'USDT', 'USD');
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS net_amount_local DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS applied_commission_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS listing_currency currency_type DEFAULT 'THB',
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_payout_currency preferred_payout_currency_type DEFAULT 'THB';

UPDATE public.bookings
SET applied_commission_rate = commission_rate
WHERE applied_commission_rate IS NULL
  AND commission_rate IS NOT NULL;

UPDATE public.bookings
SET net_amount_local = COALESCE(partner_earnings_thb, price_thb - COALESCE(commission_thb, 0))
WHERE net_amount_local IS NULL;

UPDATE public.bookings
SET listing_currency = COALESCE(listing_currency, 'THB')
WHERE listing_currency IS NULL;

UPDATE public.profiles
SET preferred_payout_currency = CASE
  WHEN preferred_currency::text IN ('RUB', 'THB', 'USDT', 'USD')
    THEN preferred_currency::text::preferred_payout_currency_type
  ELSE 'THB'::preferred_payout_currency_type
END
WHERE preferred_payout_currency IS NULL;

COMMENT ON COLUMN public.bookings.net_amount_local IS
  'Partner net amount in listing_currency frozen at booking creation';
COMMENT ON COLUMN public.bookings.applied_commission_rate IS
  'Applied commission percent snapshot used for settlement';
COMMENT ON COLUMN public.bookings.listing_currency IS
  'Listing base currency at booking creation';
COMMENT ON COLUMN public.profiles.preferred_payout_currency IS
  'Partner payout preference (subset enum for settlement screens)';
