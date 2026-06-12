-- Stage 131.7 — ReferralFraudGate: payout fingerprint on partner_payout_profiles + profiles.metadata for payout block flag.

ALTER TABLE public.partner_payout_profiles
  ADD COLUMN IF NOT EXISTS payout_fingerprint TEXT;

ALTER TABLE public.partner_payout_profiles
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.partner_payout_profiles.payout_fingerprint IS
  'Stage 131.7: SHA256(inn|account|bik) for cross-account collision detection.';

COMMENT ON COLUMN public.profiles.metadata IS
  'Stage 131.7+: JSON flags incl. referral_payout_blocked for ReferralFraudGate.';

CREATE INDEX IF NOT EXISTS idx_partner_payout_profiles_fingerprint
  ON public.partner_payout_profiles (payout_fingerprint)
  WHERE payout_fingerprint IS NOT NULL;
