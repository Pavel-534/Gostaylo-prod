-- Stage 72.6 — Tier downgrade grace + activity stamp (auth referral cookie handled in app layer).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_tier_grace_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ambassador_last_activity_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.referral_tier_grace_until IS
  'While set and in the future, downgrade of referral_tier_* is deferred (grace window, typically 30 days).';

COMMENT ON COLUMN public.profiles.ambassador_last_activity_at IS
  'Last ambassador tier sync trigger (booking/referral activity). Used for auditing; tier logic uses grace_until.';
