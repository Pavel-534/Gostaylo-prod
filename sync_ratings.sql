-- One-time Rating & Reviews Count Sync Script
-- Run this in Supabase SQL Editor to update all listings

-- Step 1: Sync ratings and review counts for all listings
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
  ), 0)
WHERE EXISTS (
  SELECT 1 FROM reviews WHERE reviews.listing_id = listings.id
);

-- Step 2: Reset listings with no reviews to 0
UPDATE listings
SET 
  reviews_count = 0,
  rating = 0
WHERE NOT EXISTS (
  SELECT 1 FROM reviews WHERE reviews.listing_id = listings.id
);

-- Step 3: Verify results
SELECT 
  id,
  title,
  rating,
  reviews_count,
  (SELECT COUNT(*) FROM reviews WHERE listing_id = listings.id) as actual_review_count
FROM listings
WHERE reviews_count > 0 OR rating > 0
ORDER BY reviews_count DESC
LIMIT 10;
