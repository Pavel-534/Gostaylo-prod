-- Hotfix if stage176_0 failed at booking_reviews view (ERROR 42P16).
-- Safe to run after partial 176.0 (columns already added) or instead of section B in 176.0.

DROP VIEW IF EXISTS public.booking_reviews;

CREATE VIEW public.booking_reviews AS
SELECT
  id,
  booking_id,
  user_id AS author_id,
  listing_id,
  rating,
  comment,
  photos,
  is_verified,
  created_at,
  updated_at,
  moderation_status
FROM public.reviews
WHERE booking_id IS NOT NULL;

COMMENT ON VIEW public.booking_reviews IS
  'Stage 141.3/176.0 alias: one review per booking (SSOT: reviews).';

GRANT SELECT ON public.booking_reviews TO anon, authenticated, service_role;
