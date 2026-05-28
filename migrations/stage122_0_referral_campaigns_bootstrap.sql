-- Stage 122.0 — Referral 2.0 Phase B3 bootstrap (campaign fields, no economics change).
-- Adds campaign identifiers and metadata slots for budget/expiry/hold override.

ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS campaign_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_referral_codes_campaign_slug
  ON public.referral_codes (campaign_slug)
  WHERE campaign_slug IS NOT NULL;

COMMENT ON COLUMN public.referral_codes.campaign_slug IS
  'Optional campaign identifier for this referral code (Phase B3).';

COMMENT ON COLUMN public.referral_codes.metadata IS
  'Campaign metadata keys (B3): campaign_slug, max_budget_thb, current_spent_thb, campaign_expires_at, override_hold_days.';

ALTER TABLE public.referral_attributions
  ADD COLUMN IF NOT EXISTS campaign_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_referral_attributions_campaign_slug_created
  ON public.referral_attributions (campaign_slug, created_at DESC)
  WHERE campaign_slug IS NOT NULL;

COMMENT ON COLUMN public.referral_attributions.campaign_slug IS
  'Campaign slug captured at click/attribution time (nullable).';
