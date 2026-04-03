-- Reviews: align with Prisma docs + audit — photo URLs, verified flag, one review per booking.
-- Run in Supabase SQL editor after creating Storage bucket `review-images` (public read; authenticated upload via API).

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT true;

-- One row per booking when booking_id is set (allows multiple NULL booking_id rows if any legacy data exists).
CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_id_unique
  ON public.reviews (booking_id)
  WHERE booking_id IS NOT NULL;

COMMENT ON COLUMN public.reviews.photos IS 'Public image URLs (e.g. /_storage/review-images/...)';
COMMENT ON COLUMN public.reviews.is_verified IS 'Shown as verified guest review when true';
