-- Stage 141.3 — Reviews baseline alias + guest_reviews GRANT

-- SSOT for guest→listing reviews remains `public.reviews`; `booking_reviews` is a read alias.
CREATE OR REPLACE VIEW public.booking_reviews AS
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
  updated_at
FROM public.reviews
WHERE booking_id IS NOT NULL;

COMMENT ON VIEW public.booking_reviews IS
  'Stage 141.3 alias: one review per completed booking (SSOT table: reviews).';

GRANT SELECT ON public.booking_reviews TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON public.guest_reviews TO authenticated, service_role;
GRANT SELECT ON public.guest_reviews TO anon;
