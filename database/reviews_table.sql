-- FunnyRent 2.1 - Reviews Table Migration
-- Stage 33.2.3 - Trust Engine & Review System

-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id),
  listing_id TEXT NOT NULL REFERENCES public.listings(id),
  booking_id TEXT REFERENCES public.bookings(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  partner_reply TEXT,
  partner_reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON public.reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON public.reviews(booking_id);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read reviews (public)
CREATE POLICY "reviews_select_all" ON public.reviews
  FOR SELECT USING (true);

-- Users can insert their own reviews
CREATE POLICY "reviews_insert_own" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Listing owners can update partner_reply
CREATE POLICY "reviews_update_reply" ON public.reviews
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = reviews.listing_id
      AND listings.owner_id = auth.uid()::text
    )
  );

-- Grant access
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT ON public.reviews TO authenticated;
GRANT UPDATE ON public.reviews TO authenticated;

COMMENT ON TABLE public.reviews IS 'Guest reviews for listings with partner replies';
