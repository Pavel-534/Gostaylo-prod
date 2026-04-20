-- PR-#3: Partner reviews of guests (one row per booking; author = partner).

CREATE TABLE IF NOT EXISTS public.guest_reviews (
  id TEXT PRIMARY KEY DEFAULT ('gr-' || gen_random_uuid()::text),
  author_id TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  guest_id TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guest_reviews_booking_unique UNIQUE (booking_id),
  CONSTRAINT guest_reviews_author_guest_check CHECK (author_id <> guest_id)
);

CREATE INDEX IF NOT EXISTS idx_guest_reviews_author_id ON public.guest_reviews (author_id);
CREATE INDEX IF NOT EXISTS idx_guest_reviews_guest_id ON public.guest_reviews (guest_id);

COMMENT ON TABLE public.guest_reviews IS 'Partner-authored review of a guest after a booking; consumed by GET /api/v2/partner/pending-reviews.';
COMMENT ON COLUMN public.guest_reviews.author_id IS 'Partner (host) profile id.';
COMMENT ON COLUMN public.guest_reviews.guest_id IS 'Renter profile id.';
