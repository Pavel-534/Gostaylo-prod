-- Stage 176.1.0 — moderation_status 'removed' + staff queue support

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_moderation_status_check;
ALTER TABLE public.guest_reviews DROP CONSTRAINT IF EXISTS guest_reviews_moderation_status_check;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_moderation_status_check
  CHECK (moderation_status IN ('approved', 'flagged', 'removed'));

ALTER TABLE public.guest_reviews
  ADD CONSTRAINT guest_reviews_moderation_status_check
  CHECK (moderation_status IN ('approved', 'flagged', 'removed'));

COMMENT ON COLUMN public.reviews.moderation_status IS
  'Stage 176: approved | flagged | removed (staff via PATCH /api/admin/reviews/:id/moderation).';
