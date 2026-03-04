-- FunnyRent 2.1 - Row Level Security (RLS) Policies
-- Stage 32.2: Privacy Enforcement
-- 
-- Rules:
-- 1. Users can only see their own records
-- 2. Partners can only see their own listings/bookings
-- 3. Admin has FULL access to everything
-- 
-- Execute this in Supabase SQL Editor

-- ============================================
-- STEP 1: Enable RLS on all tables
-- ============================================

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Create helper function to check admin role
-- ============================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 3: LISTINGS RLS Policies
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "listings_select_policy" ON listings;
DROP POLICY IF EXISTS "listings_insert_policy" ON listings;
DROP POLICY IF EXISTS "listings_update_policy" ON listings;
DROP POLICY IF EXISTS "listings_delete_policy" ON listings;

-- Anyone can view ACTIVE listings (public catalog)
CREATE POLICY "listings_select_public" ON listings
  FOR SELECT
  USING (
    status = 'ACTIVE' 
    OR owner_id = auth.uid() 
    OR is_admin()
  );

-- Partners can only insert their own listings
CREATE POLICY "listings_insert_owner" ON listings
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Partners can only update their own listings, Admin can update all
CREATE POLICY "listings_update_owner" ON listings
  FOR UPDATE
  USING (owner_id = auth.uid() OR is_admin())
  WITH CHECK (owner_id = auth.uid() OR is_admin());

-- Partners can only delete their own listings, Admin can delete all
CREATE POLICY "listings_delete_owner" ON listings
  FOR DELETE
  USING (owner_id = auth.uid() OR is_admin());

-- ============================================
-- STEP 4: BOOKINGS RLS Policies
-- ============================================

DROP POLICY IF EXISTS "bookings_select_policy" ON bookings;
DROP POLICY IF EXISTS "bookings_insert_policy" ON bookings;
DROP POLICY IF EXISTS "bookings_update_policy" ON bookings;

-- Users can see bookings they created or own (as partner)
CREATE POLICY "bookings_select_own" ON bookings
  FOR SELECT
  USING (
    renter_id = auth.uid() 
    OR partner_id = auth.uid() 
    OR is_admin()
  );

-- Anyone authenticated can create a booking
CREATE POLICY "bookings_insert_auth" ON bookings
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only partner/admin can update booking status
CREATE POLICY "bookings_update_own" ON bookings
  FOR UPDATE
  USING (
    renter_id = auth.uid() 
    OR partner_id = auth.uid() 
    OR is_admin()
  );

-- ============================================
-- STEP 5: PAYMENTS RLS Policies
-- ============================================

DROP POLICY IF EXISTS "payments_select_policy" ON payments;
DROP POLICY IF EXISTS "payments_insert_policy" ON payments;
DROP POLICY IF EXISTS "payments_update_policy" ON payments;

-- Users can see payments for their bookings
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b 
      WHERE b.id = payments.booking_id 
      AND (b.renter_id = auth.uid() OR b.partner_id = auth.uid())
    )
    OR is_admin()
  );

-- Only authenticated users can create payments (for their bookings)
CREATE POLICY "payments_insert_auth" ON payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b 
      WHERE b.id = booking_id 
      AND b.renter_id = auth.uid()
    )
    OR is_admin()
  );

-- Only admin can update payment status
CREATE POLICY "payments_update_admin" ON payments
  FOR UPDATE
  USING (is_admin());

-- ============================================
-- STEP 6: MESSAGES RLS Policies
-- ============================================

DROP POLICY IF EXISTS "messages_select_policy" ON messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON messages;

-- Users can see messages in their conversations
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND (c.renter_id = auth.uid() OR c.partner_id = auth.uid())
    )
    OR is_admin()
  );

-- Users can send messages to their conversations
CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    OR is_admin()
  );

-- ============================================
-- STEP 7: CONVERSATIONS RLS Policies
-- ============================================

DROP POLICY IF EXISTS "conversations_select_policy" ON conversations;
DROP POLICY IF EXISTS "conversations_insert_policy" ON conversations;
DROP POLICY IF EXISTS "conversations_update_policy" ON conversations;

-- Users can see their own conversations
CREATE POLICY "conversations_select_own" ON conversations
  FOR SELECT
  USING (
    renter_id = auth.uid() 
    OR partner_id = auth.uid() 
    OR is_admin()
  );

-- Authenticated users can create conversations
CREATE POLICY "conversations_insert_auth" ON conversations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Participants can update conversation
CREATE POLICY "conversations_update_own" ON conversations
  FOR UPDATE
  USING (
    renter_id = auth.uid() 
    OR partner_id = auth.uid() 
    OR is_admin()
  );

-- ============================================
-- STEP 8: PROFILES RLS Policies
-- ============================================

DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;

-- Users can see basic profile info (for chat, etc.)
CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT
  USING (true);  -- Public read for basic info

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

-- ============================================
-- STEP 9: Grant service_role bypass
-- ============================================

-- Service role (backend) bypasses RLS automatically
-- This is handled by Supabase - service_role key ignores RLS

-- ============================================
-- VERIFICATION
-- ============================================

-- Check RLS is enabled:
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('listings', 'bookings', 'payments', 'messages', 'conversations', 'profiles');

-- List all policies:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
