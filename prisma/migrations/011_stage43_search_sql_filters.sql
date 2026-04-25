-- Stage 43.0 — Search architecture evolution (SQL-first filters).
-- 1) Listing-level instant booking flag (SSOT for search filters).
-- 2) GIN index for metadata->amenities JSONB lookup.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS instant_booking boolean NOT NULL DEFAULT false;

-- Initial sync from profile defaults for existing listings.
UPDATE public.listings AS l
SET instant_booking = COALESCE(p.instant_booking, false)
FROM public.profiles AS p
WHERE p.id = l.owner_id
  AND l.instant_booking IS DISTINCT FROM COALESCE(p.instant_booking, false);

CREATE INDEX IF NOT EXISTS idx_listings_metadata_amenities_gin
  ON public.listings
  USING GIN ((metadata -> 'amenities'));

COMMENT ON COLUMN public.listings.instant_booking IS
  'Listing-level instant booking flag (priority over profile defaults).';
