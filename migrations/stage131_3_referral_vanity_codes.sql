-- Stage 131.3 — vanity referral links (/go/phuket-pasha)
-- SSOT: custom_vanity_code on referral_codes (latin + digits + hyphens, unique).

ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS custom_vanity_code TEXT;

COMMENT ON COLUMN public.referral_codes.custom_vanity_code IS
  'Optional vanity slug for /go/{code}, e.g. phuket-pasha. Lowercase latin, digits, hyphens.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_custom_vanity_code_lower
  ON public.referral_codes (lower(custom_vanity_code))
  WHERE custom_vanity_code IS NOT NULL AND trim(custom_vanity_code) <> '';

ALTER TABLE public.referral_codes
  DROP CONSTRAINT IF EXISTS referral_codes_custom_vanity_format_chk;

ALTER TABLE public.referral_codes
  ADD CONSTRAINT referral_codes_custom_vanity_format_chk CHECK (
    custom_vanity_code IS NULL
    OR (
      char_length(trim(custom_vanity_code)) >= 3
      AND char_length(trim(custom_vanity_code)) <= 48
      AND trim(custom_vanity_code) ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    )
  );
