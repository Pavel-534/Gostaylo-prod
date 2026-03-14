-- Gostaylo - Reviews Multi-Category Rating Migration (FIXED)
-- Phase 4: Trust & Ratings System
-- Run this in Supabase SQL Editor

-- Step 1: Change rating column type to support decimal values (4.6, 4.8, etc.)
ALTER TABLE public.reviews 
ALTER COLUMN rating TYPE NUMERIC(2,1);

-- Step 2: Add multi-category rating columns
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS rating_cleanliness INTEGER CHECK (rating_cleanliness >= 1 AND rating_cleanliness <= 5),
ADD COLUMN IF NOT EXISTS rating_accuracy INTEGER CHECK (rating_accuracy >= 1 AND rating_accuracy <= 5),
ADD COLUMN IF NOT EXISTS rating_communication INTEGER CHECK (rating_communication >= 1 AND rating_communication <= 5),
ADD COLUMN IF NOT EXISTS rating_location INTEGER CHECK (rating_location >= 1 AND rating_location <= 5),
ADD COLUMN IF NOT EXISTS rating_value INTEGER CHECK (rating_value >= 1 AND rating_value <= 5);

-- Step 3: Drop old constraint if exists
ALTER TABLE public.reviews 
DROP CONSTRAINT IF EXISTS check_all_categories_or_none;

-- Step 4: Add constraint: if any category rating exists, all must exist
ALTER TABLE public.reviews 
ADD CONSTRAINT check_all_categories_or_none 
CHECK (
  (rating_cleanliness IS NULL AND rating_accuracy IS NULL AND rating_communication IS NULL AND rating_location IS NULL AND rating_value IS NULL)
  OR
  (rating_cleanliness IS NOT NULL AND rating_accuracy IS NOT NULL AND rating_communication IS NOT NULL AND rating_location IS NOT NULL AND rating_value IS NOT NULL)
);

-- Step 5: Create function to calculate average rating from categories
CREATE OR REPLACE FUNCTION calculate_average_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- If category ratings provided, calculate average
  IF NEW.rating_cleanliness IS NOT NULL THEN
    NEW.rating := ROUND((
      NEW.rating_cleanliness + 
      NEW.rating_accuracy + 
      NEW.rating_communication + 
      NEW.rating_location + 
      NEW.rating_value
    )::numeric / 5, 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to auto-calculate rating on insert/update
DROP TRIGGER IF EXISTS trigger_calculate_rating ON public.reviews;
CREATE TRIGGER trigger_calculate_rating
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION calculate_average_rating();

-- Step 7: Update listings table to support rating (if columns don't exist)
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;

-- Step 8: Create index for faster rating queries
CREATE INDEX IF NOT EXISTS idx_reviews_rating_categories 
ON public.reviews(rating_cleanliness, rating_accuracy, rating_communication, rating_location, rating_value);

CREATE INDEX IF NOT EXISTS idx_listings_rating 
ON public.listings(rating) WHERE rating > 0;

-- Step 9: Update comment
COMMENT ON TABLE public.reviews IS 'Guest reviews with 5-category ratings (Cleanliness, Accuracy, Communication, Location, Value) - Gostaylo v2 Phase 4';

-- SUCCESS MESSAGE
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Migration complete! Multi-category rating system enabled.';
  RAISE NOTICE '📊 New columns: rating_cleanliness, rating_accuracy, rating_communication, rating_location, rating_value';
  RAISE NOTICE '⚡ Auto-calculate trigger: calculate_average_rating()';
  RAISE NOTICE '🎯 Rating type changed to NUMERIC(2,1) for decimal support';
END $$;
