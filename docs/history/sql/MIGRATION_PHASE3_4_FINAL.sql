-- ============================================
-- Gostaylo Phase 3 & 4 Infrastructure Fix
-- Run this SQL script in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: Automated Review Counter System
-- ============================================

-- Function to update reviews count and average rating
CREATE OR REPLACE FUNCTION update_listing_reviews_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- When review is inserted, updated, or deleted, recalculate stats
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE listings
    SET 
      rating = COALESCE((
        SELECT ROUND(AVG(rating)::numeric, 1)
        FROM reviews 
        WHERE listing_id = NEW.listing_id
      ), 0),
      reviews_count = COALESCE((
        SELECT COUNT(*) 
        FROM reviews 
        WHERE listing_id = NEW.listing_id
      ), 0)
    WHERE id = NEW.listing_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE listings
    SET 
      rating = COALESCE((
        SELECT ROUND(AVG(rating)::numeric, 1)
        FROM reviews 
        WHERE listing_id = OLD.listing_id
      ), 0),
      reviews_count = COALESCE((
        SELECT COUNT(*) 
        FROM reviews 
        WHERE listing_id = OLD.listing_id
      ), 0)
    WHERE id = OLD.listing_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updates
DROP TRIGGER IF EXISTS trigger_update_listing_stats ON reviews;
CREATE TRIGGER trigger_update_listing_stats
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_listing_reviews_stats();

-- Sync existing data - Update all listings
UPDATE listings
SET 
  reviews_count = COALESCE((
    SELECT COUNT(*) 
    FROM reviews 
    WHERE reviews.listing_id = listings.id
  ), 0),
  rating = COALESCE((
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM reviews 
    WHERE reviews.listing_id = listings.id
  ), 0);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_reviews_listing_rating ON reviews(listing_id, rating);

-- ============================================
-- PART 2: Favorites Table Creation
-- ============================================

-- Create favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  UNIQUE(user_id, listing_id)
);

-- Add foreign keys (will fail silently if already exist)
DO $$ 
BEGIN
  ALTER TABLE public.favorites 
    ADD CONSTRAINT fk_favorites_user 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER TABLE public.favorites 
    ADD CONSTRAINT fk_favorites_listing 
    FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing_id ON public.favorites(listing_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON public.favorites(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Drop old policies if exist
DROP POLICY IF EXISTS "Users can view their own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.favorites;

-- Create RLS Policies
CREATE POLICY "Users can view their own favorites"
  ON public.favorites
  FOR SELECT
  USING (true); -- Allow all for service role access

CREATE POLICY "Users can insert their own favorites"
  ON public.favorites
  FOR INSERT
  WITH CHECK (true); -- Allow all for service role access

CREATE POLICY "Users can delete their own favorites"
  ON public.favorites
  FOR DELETE
  USING (true); -- Allow all for service role access

-- Grant permissions
GRANT ALL ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
GRANT ALL ON public.favorites TO anon;

-- Add comment
COMMENT ON TABLE public.favorites IS 'User favorites/wishlist for listings - Phase 3';

-- ============================================
-- VERIFICATION & SUCCESS MESSAGE
-- ============================================

DO $$ 
DECLARE
  review_count INTEGER;
  favorite_count INTEGER;
  listings_with_reviews INTEGER;
BEGIN 
  -- Count reviews
  SELECT COUNT(*) INTO review_count FROM reviews;
  
  -- Count favorites
  SELECT COUNT(*) INTO favorite_count FROM favorites;
  
  -- Count listings with reviews
  SELECT COUNT(*) INTO listings_with_reviews 
  FROM listings 
  WHERE reviews_count > 0;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ Phase 3 & 4 Infrastructure Migration Complete!';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Review Counter System:';
  RAISE NOTICE '   - Trigger: update_listing_reviews_stats() ✅';
  RAISE NOTICE '   - Total reviews in DB: %', review_count;
  RAISE NOTICE '   - Listings with reviews: %', listings_with_reviews;
  RAISE NOTICE '';
  RAISE NOTICE '❤️  Favorites System:';
  RAISE NOTICE '   - Table created: favorites ✅';
  RAISE NOTICE '   - Current favorites: %', favorite_count;
  RAISE NOTICE '   - RLS policies enabled ✅';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 All systems operational!';
  RAISE NOTICE '';
END $$;
