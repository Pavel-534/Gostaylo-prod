-- Gostaylo - Automated Review Counter System
-- Automatically updates reviews_count in listings table

-- Step 1: Create function to update reviews_count
CREATE OR REPLACE FUNCTION update_listing_reviews_count()
RETURNS TRIGGER AS $$
BEGIN
  -- When review is inserted or deleted, update the listing's reviews_count
  IF (TG_OP = 'INSERT') THEN
    UPDATE listings
    SET reviews_count = (
      SELECT COUNT(*) 
      FROM reviews 
      WHERE listing_id = NEW.listing_id
    )
    WHERE id = NEW.listing_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE listings
    SET reviews_count = (
      SELECT COUNT(*) 
      FROM reviews 
      WHERE listing_id = OLD.listing_id
    )
    WHERE id = OLD.listing_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger on reviews table
DROP TRIGGER IF EXISTS trigger_update_reviews_count ON reviews;
CREATE TRIGGER trigger_update_reviews_count
  AFTER INSERT OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_listing_reviews_count();

-- Step 3: Create function to also update average rating when reviews change
CREATE OR REPLACE FUNCTION update_listing_average_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- When review is inserted, updated, or deleted, recalculate average rating
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE listings
    SET rating = (
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews 
      WHERE listing_id = NEW.listing_id
    ),
    reviews_count = (
      SELECT COUNT(*) 
      FROM reviews 
      WHERE listing_id = NEW.listing_id
    )
    WHERE id = NEW.listing_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE listings
    SET rating = (
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews 
      WHERE listing_id = OLD.listing_id
    ),
    reviews_count = (
      SELECT COUNT(*) 
      FROM reviews 
      WHERE listing_id = OLD.listing_id
    )
    WHERE id = OLD.listing_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger for average rating update
DROP TRIGGER IF EXISTS trigger_update_avg_rating ON reviews;
CREATE TRIGGER trigger_update_avg_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_listing_average_rating();

-- Step 5: Sync existing data - Update all listings with current review counts and ratings
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

-- Step 6: Create index for performance
CREATE INDEX IF NOT EXISTS idx_reviews_listing_id_rating ON reviews(listing_id, rating);

-- SUCCESS MESSAGE
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Automated Review Counter System enabled!';
  RAISE NOTICE '📊 Trigger: update_listing_reviews_count() - counts reviews';
  RAISE NOTICE '⭐ Trigger: update_listing_average_rating() - calculates average';
  RAISE NOTICE '🔄 All existing listings synced with current data';
END $$;
