-- ========================================
-- Phase 7.1: Favorites Table Creation
-- ========================================
-- Purpose: Store user's favorite listings for quick access

-- Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate favorites
  UNIQUE(user_id, listing_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing_id ON favorites(listing_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(created_at DESC);

-- Enable Row Level Security
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for favorites
-- 1. Users can view their own favorites
CREATE POLICY "users_view_own_favorites"
ON favorites FOR SELECT
USING (user_id = auth.uid());

-- 2. Users can add to their own favorites
CREATE POLICY "users_insert_own_favorites"
ON favorites FOR INSERT
WITH CHECK (user_id = auth.uid());

-- 3. Users can remove from their own favorites
CREATE POLICY "users_delete_own_favorites"
ON favorites FOR DELETE
USING (user_id = auth.uid());

-- 4. Admins can view all favorites (for moderation)
CREATE POLICY "admins_view_all_favorites"
ON favorites FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- Verification query
SELECT 
  'Favorites table created successfully' as status,
  COUNT(*) as existing_favorites_count
FROM favorites;

-- Sample query to test
-- SELECT f.*, l.title as listing_title, p.email as user_email
-- FROM favorites f
-- LEFT JOIN listings l ON f.listing_id = l.id
-- LEFT JOIN profiles p ON f.user_id = p.id
-- ORDER BY f.created_at DESC
-- LIMIT 10;
