-- Gostaylo - Reviews Multi-Category Rating Migration (Phase 4)
-- Upgrades reviews table to support Airbnb-style 5-category ratings

-- Add new rating columns
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS rating_cleanliness INTEGER CHECK (rating_cleanliness >= 1 AND rating_cleanliness <= 5),
ADD COLUMN IF NOT EXISTS rating_accuracy INTEGER CHECK (rating_accuracy >= 1 AND rating_accuracy <= 5),
ADD COLUMN IF NOT EXISTS rating_communication INTEGER CHECK (rating_communication >= 1 AND rating_communication <= 5),
ADD COLUMN IF NOT EXISTS rating_location INTEGER CHECK (rating_location >= 1 AND rating_location <= 5),
ADD COLUMN IF NOT EXISTS rating_value INTEGER CHECK (rating_value >= 1 AND rating_value <= 5);

-- Update existing 'rating' column to be calculated average (for backwards compatibility)
-- Note: 'rating' will now be auto-calculated from category ratings

-- Add constraint: if any category rating exists, all must exist
ALTER TABLE public.reviews 
ADD CONSTRAINT check_all_categories_or_none 
CHECK (
  (rating_cleanliness IS NULL AND rating_accuracy IS NULL AND rating_communication IS NULL AND rating_location IS NULL AND rating_value IS NULL)
  OR
  (rating_cleanliness IS NOT NULL AND rating_accuracy IS NOT NULL AND rating_communication IS NOT NULL AND rating_location IS NOT NULL AND rating_value IS NOT NULL)
);

-- Create function to calculate average rating from categories
CREATE OR REPLACE FUNCTION calculate_average_rating()
RETURNS TRIGGER AS $$
BEGIN
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

-- Create trigger to auto-calculate rating
DROP TRIGGER IF EXISTS trigger_calculate_rating ON public.reviews;
CREATE TRIGGER trigger_calculate_rating
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION calculate_average_rating();

-- Update comment
COMMENT ON TABLE public.reviews IS 'Guest reviews with 5-category ratings (Cleanliness, Accuracy, Communication, Location, Value) - Gostaylo v2';

-- Add index for faster average calculations
CREATE INDEX IF NOT EXISTS idx_reviews_rating_categories ON public.reviews(rating_cleanliness, rating_accuracy, rating_communication, rating_location, rating_value);
