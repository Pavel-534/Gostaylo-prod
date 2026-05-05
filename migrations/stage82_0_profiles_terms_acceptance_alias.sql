-- Stage 82.0
-- Добавляет явные поля terms_accepted / terms_accepted_at как SSOT one-time оферты,
-- сохраняя обратную совместимость с legal_terms_accepted_at.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz NULL;

-- Backfill из существующего правового таймстампа.
UPDATE public.profiles
SET
  terms_accepted = true,
  terms_accepted_at = COALESCE(terms_accepted_at, legal_terms_accepted_at)
WHERE legal_terms_accepted_at IS NOT NULL
  AND (terms_accepted = false OR terms_accepted_at IS NULL);

COMMENT ON COLUMN public.profiles.terms_accepted IS
  'One-time acceptance flag for public offer/privacy flow.';
COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'Timestamp when user accepted terms. Mirrors legal_terms_accepted_at for backward compatibility.';

CREATE INDEX IF NOT EXISTS idx_profiles_terms_accepted_at
  ON public.profiles (terms_accepted_at DESC)
  WHERE terms_accepted_at IS NOT NULL;
