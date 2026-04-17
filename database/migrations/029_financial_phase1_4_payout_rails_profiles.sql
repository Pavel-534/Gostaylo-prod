-- Phase 1.4: Payout rails, partner payout profiles, taxable base, rounding pot.

DO $$
BEGIN
  CREATE TYPE payout_fee_type AS ENUM ('percentage', 'fixed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE payout_method_channel_type AS ENUM ('CARD', 'BANK', 'CRYPTO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.payout_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channel payout_method_channel_type NOT NULL DEFAULT 'CARD',
  fee_type payout_fee_type NOT NULL,
  value NUMERIC(12,4) NOT NULL CHECK (value >= 0),
  currency TEXT NOT NULL DEFAULT 'THB',
  min_payout NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_payout >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_methods_active
  ON public.payout_methods (is_active, currency);

CREATE TABLE IF NOT EXISTS public.partner_payout_profiles (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  method_id TEXT NOT NULL REFERENCES public.payout_methods(id) ON DELETE RESTRICT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_payout_profiles_partner
  ON public.partner_payout_profiles (partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_payout_profiles_method
  ON public.partner_payout_profiles (method_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_default_payout_profile
  ON public.partner_payout_profiles (partner_id)
  WHERE is_default = TRUE;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS taxable_margin_amount NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS rounding_diff_pot NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS payout_method_id TEXT REFERENCES public.payout_methods(id) ON DELETE SET NULL;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS payout_profile_id TEXT REFERENCES public.partner_payout_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS payout_fee_amount NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(12,2) DEFAULT 0;

UPDATE public.bookings
SET
  taxable_margin_amount = ROUND(
    GREATEST(
      0,
      (
        COALESCE(price_paid * NULLIF(exchange_rate, 0), price_thb + COALESCE(commission_thb, 0))
        - COALESCE(partner_earnings_thb, price_thb)
      )::numeric
    ),
    2
  ),
  rounding_diff_pot = COALESCE(rounding_diff_pot, 0)
WHERE taxable_margin_amount IS NULL OR rounding_diff_pot IS NULL;

INSERT INTO public.payout_methods (id, name, channel, fee_type, value, currency, min_payout, is_active)
VALUES
  ('pm-card-ru', 'Карта РФ', 'CARD', 'fixed', 3.5, 'RUB', 500, TRUE),
  ('pm-bank-ru', 'Банк РФ', 'BANK', 'fixed', 25, 'RUB', 1000, TRUE),
  ('pm-bank-th', 'Thai Bank Transfer', 'BANK', 'percentage', 0.8, 'THB', 500, TRUE),
  ('pm-usdt-trc20', 'USDT TRC20', 'CRYPTO', 'fixed', 1.0, 'USDT', 30, TRUE)
ON CONFLICT (id) DO NOTHING;
