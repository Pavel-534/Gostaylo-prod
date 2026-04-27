-- Stage 72.5 — Ambassador tiers + analytics readiness.

CREATE TABLE IF NOT EXISTS public.referral_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  min_partners_invited INTEGER NOT NULL CHECK (min_partners_invited >= 0),
  payout_ratio NUMERIC(5, 2) NOT NULL CHECK (payout_ratio >= 0 AND payout_ratio <= 100),
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.referral_tiers IS
  'Ambassador payout tiers. payout_ratio controls withdrawable share for referral_bonus.';
COMMENT ON COLUMN public.referral_tiers.payout_ratio IS
  'Percent of referral bonus that goes to withdrawable wallet bucket.';

INSERT INTO public.referral_tiers (id, name, min_partners_invited, payout_ratio, description)
VALUES
  ('tier-beginner', 'Beginner', 0, 60, '0+ partners invited'),
  ('tier-pro', 'Pro', 5, 75, '5+ partners invited'),
  ('tier-ambassador', 'Ambassador', 20, 85, '20+ partners invited')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  min_partners_invited = EXCLUDED.min_partners_invited,
  payout_ratio = EXCLUDED.payout_ratio,
  description = EXCLUDED.description,
  updated_at = now();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_tier_id TEXT,
  ADD COLUMN IF NOT EXISTS referral_tier_name TEXT,
  ADD COLUMN IF NOT EXISTS referral_tier_payout_ratio NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS referral_tier_partner_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_tier_upgraded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_tier_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_tier_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ALTER COLUMN referral_tier_id SET DEFAULT 'tier-beginner',
  ALTER COLUMN referral_tier_name SET DEFAULT 'Beginner',
  ALTER COLUMN referral_tier_payout_ratio SET DEFAULT 60;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_referral_tier_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_referral_tier_id_fkey
      FOREIGN KEY (referral_tier_id)
      REFERENCES public.referral_tiers(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END$$;

UPDATE public.profiles
SET
  referral_tier_id = COALESCE(referral_tier_id, 'tier-beginner'),
  referral_tier_name = COALESCE(referral_tier_name, 'Beginner'),
  referral_tier_payout_ratio = COALESCE(referral_tier_payout_ratio, 60),
  referral_tier_updated_at = COALESCE(referral_tier_updated_at, now())
WHERE referral_tier_id IS NULL
   OR referral_tier_name IS NULL
   OR referral_tier_payout_ratio IS NULL;
