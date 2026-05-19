-- Stage 102.1 — версия оферты и согласие на уровне брони / партнёра

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_version text NULL,
  ADD COLUMN IF NOT EXISTS partner_terms_accepted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS partner_terms_version text NULL;

COMMENT ON COLUMN public.profiles.terms_version IS
  'Version string of public offer accepted by user (e.g. 2026-05-18-v1).';
COMMENT ON COLUMN public.profiles.partner_terms_accepted_at IS
  'When user accepted host/partner terms before partner application.';
COMMENT ON COLUMN public.profiles.partner_terms_version IS
  'Version of partner/host terms accepted.';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS terms_version text NULL;

COMMENT ON COLUMN public.bookings.terms_accepted_at IS
  'Guest acceptance of public offer at payment for this booking.';
COMMENT ON COLUMN public.bookings.terms_version IS
  'Public offer version accepted for this booking payment.';

CREATE INDEX IF NOT EXISTS idx_bookings_terms_accepted_at
  ON public.bookings (terms_accepted_at DESC)
  WHERE terms_accepted_at IS NOT NULL;
