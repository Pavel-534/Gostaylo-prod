-- Stage 120.0 — Referral 2.0 Phase A: click attribution (first-touch 30d, last-touch 7d).
-- SSOT service: lib/referral/attribution.service.js
-- Does NOT change referral_ledger economics.

CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id TEXT PRIMARY KEY,
  click_id TEXT NOT NULL,
  referrer_id TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  referral_code TEXT NOT NULL,
  touch_type TEXT NOT NULL CHECK (touch_type IN ('first', 'last')),
  landing_path TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device_hash TEXT,
  ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'clicked'
    CHECK (status IN ('clicked', 'converted', 'expired', 'blocked')),
  converted_profile_id TEXT REFERENCES public.profiles (id) ON DELETE SET NULL,
  booking_id TEXT REFERENCES public.bookings (id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT referral_attributions_click_id_key UNIQUE (click_id),
  CONSTRAINT referral_attributions_referrer_self_chk CHECK (char_length(trim(referral_code)) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_referrer_created
  ON public.referral_attributions (referrer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_device_first
  ON public.referral_attributions (device_hash, touch_type, status, expires_at DESC)
  WHERE device_hash IS NOT NULL AND touch_type = 'first';

CREATE INDEX IF NOT EXISTS idx_referral_attributions_click_id
  ON public.referral_attributions (click_id);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_converted_profile
  ON public.referral_attributions (converted_profile_id)
  WHERE converted_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_attributions_booking_id
  ON public.referral_attributions (booking_id)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_attributions_ip_day
  ON public.referral_attributions (ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

COMMENT ON TABLE public.referral_attributions IS
  'Referral click attribution: first-touch (30d) and last-touch (7d) before signup/booking.';
COMMENT ON COLUMN public.referral_attributions.click_id IS
  'Public click token stored in cookie gostaylo_ref (last-touch).';
COMMENT ON COLUMN public.referral_attributions.touch_type IS
  'first = first-touch window 30d; last = last-touch window 7d.';
