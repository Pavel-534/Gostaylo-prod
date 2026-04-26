-- Stage 67.0 — SSOT: categories.wizard_profile drives wizard + registry behavior (fallback: slug heuristics in code).
-- Apply on Supabase (public.categories). Safe to re-run (IF NOT EXISTS + conditional updates).

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS wizard_profile TEXT;

UPDATE public.categories
SET wizard_profile = 'stay'
WHERE lower(trim(slug)) = 'property'
  AND (wizard_profile IS NULL OR trim(wizard_profile) = '');

UPDATE public.categories
SET wizard_profile = 'transport'
WHERE lower(trim(slug)) = 'vehicles'
  AND (wizard_profile IS NULL OR trim(wizard_profile) = '');

UPDATE public.categories
SET wizard_profile = 'yacht'
WHERE lower(trim(slug)) = 'yachts'
  AND (wizard_profile IS NULL OR trim(wizard_profile) = '');

UPDATE public.categories
SET wizard_profile = 'tour'
WHERE lower(trim(slug)) = 'tours'
  AND (wizard_profile IS NULL OR trim(wizard_profile) = '');

COMMENT ON COLUMN public.categories.wizard_profile IS
  'SSOT vertical: stay | transport | transport_helicopter | yacht | tour | nanny | chef | massage | service_generic';
