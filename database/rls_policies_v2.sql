-- FunnyRent 2.1 - Row Level Security (RLS) Policies v2
-- Stage 33.1: Security Alignment with TEXT IDs
-- 
-- CRITICAL FIX: All ID comparisons now use ::text casting
-- because Supabase auth.uid() returns UUID but our IDs are stored as TEXT
-- 
-- Execute this in Supabase SQL Editor

-- ============================================
-- STEP 0: DISABLE RLS TEMPORARILY TO FIX
-- ============================================

-- First, drop all existing policies
DROP POLICY IF EXISTS "listings_select_public" ON listings;
DROP POLICY IF EXISTS "listings_insert_owner" ON listings;
DROP POLICY IF EXISTS "listings_update_owner" ON listings;
DROP POLICY IF EXISTS "listings_delete_owner" ON listings;
DROP POLICY IF EXISTS "bookings_select_own" ON bookings;
DROP POLICY IF EXISTS "bookings_insert_auth" ON bookings;
DROP POLICY IF EXISTS "bookings_update_own" ON bookings;
DROP POLICY IF EXISTS "payments_select_own" ON payments;
DROP POLICY IF EXISTS "payments_insert_auth" ON payments;
DROP POLICY IF EXISTS "payments_update_admin" ON payments;
DROP POLICY IF EXISTS "messages_select_own" ON messages;
DROP POLICY IF EXISTS "messages_insert_own" ON messages;
DROP POLICY IF EXISTS "conversations_select_own" ON conversations;
DROP POLICY IF EXISTS "conversations_insert_auth" ON conversations;
DROP POLICY IF EXISTS "conversations_update_own" ON conversations;
DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- Drop old function
DROP FUNCTION IF EXISTS is_admin();

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
-- STEP 2: Create helper function (with TEXT casting)
-- ============================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid()::text 
    AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper to get current user ID as TEXT
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.uid()::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 3: LISTINGS RLS Policies (with TEXT casting)
-- ============================================

-- Anyone can view ACTIVE listings, owners see their own
CREATE POLICY "listings_select_public" ON listings
  FOR SELECT
  USING (
    status = 'ACTIVE' 
    OR owner_id = auth.uid()::text 
    OR is_admin()
  );

-- Partners can insert listings (owner_id must match their ID)
CREATE POLICY "listings_insert_owner" ON listings
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()::text
    OR is_admin()
  );

-- Partners can update their own listings
CREATE POLICY "listings_update_owner" ON listings
  FOR UPDATE
  USING (owner_id = auth.uid()::text OR is_admin())
  WITH CHECK (owner_id = auth.uid()::text OR is_admin());

-- Partners can delete their own listings
CREATE POLICY "listings_delete_owner" ON listings
  FOR DELETE
  USING (owner_id = auth.uid()::text OR is_admin());

-- ============================================
-- STEP 4: BOOKINGS RLS Policies (with TEXT casting)
-- ============================================

-- Users see bookings they created (renter) or own property (partner)
CREATE POLICY "bookings_select_own" ON bookings
  FOR SELECT
  USING (
    renter_id = auth.uid()::text 
    OR partner_id = auth.uid()::text 
    OR is_admin()
  );

-- Authenticated users can create bookings
-- IMPORTANT: renter_id must be set to current user
CREATE POLICY "bookings_insert_auth" ON bookings
  FOR INSERT
  WITH CHECK (
    renter_id = auth.uid()::text
    OR is_admin()
  );

-- Renter/Partner/Admin can update booking
CREATE POLICY "bookings_update_own" ON bookings
  FOR UPDATE
  USING (
    renter_id = auth.uid()::text 
    OR partner_id = auth.uid()::text 
    OR is_admin()
  );

-- ============================================
-- STEP 5: PAYMENTS RLS Policies (with TEXT casting)
-- ============================================

-- Users see payments for their bookings
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b 
      WHERE b.id = payments.booking_id 
      AND (b.renter_id = auth.uid()::text OR b.partner_id = auth.uid()::text)
    )
    OR is_admin()
  );

-- Renters can create payments for their bookings
CREATE POLICY "payments_insert_auth" ON payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b 
      WHERE b.id = booking_id 
      AND b.renter_id = auth.uid()::text
    )
    OR is_admin()
  );

-- Only admin can update payment status
CREATE POLICY "payments_update_admin" ON payments
  FOR UPDATE
  USING (is_admin());

-- ============================================
-- STEP 6: MESSAGES RLS Policies (with TEXT casting)
-- ============================================

-- Users see messages in their conversations
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT
  USING (
    sender_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND (c.renter_id = auth.uid()::text OR c.partner_id = auth.uid()::text)
    )
    OR is_admin()
  );

-- Users can send messages (sender must be current user)
CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()::text
    OR is_admin()
  );

-- ============================================
-- STEP 7: CONVERSATIONS RLS Policies (with TEXT casting)
-- ============================================

-- Users see their conversations
CREATE POLICY "conversations_select_own" ON conversations
  FOR SELECT
  USING (
    renter_id = auth.uid()::text 
    OR partner_id = auth.uid()::text 
    OR is_admin()
  );

-- Authenticated users can create conversations
CREATE POLICY "conversations_insert_auth" ON conversations
  FOR INSERT
  WITH CHECK (
    renter_id = auth.uid()::text
    OR partner_id = auth.uid()::text
    OR is_admin()
  );

-- Participants can update conversation
CREATE POLICY "conversations_update_own" ON conversations
  FOR UPDATE
  USING (
    renter_id = auth.uid()::text 
    OR partner_id = auth.uid()::text 
    OR is_admin()
  );

-- ============================================
-- STEP 8: PROFILES RLS Policies
-- ============================================

-- Public read for basic profile info (needed for chat names)
CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (id = auth.uid()::text OR is_admin())
  WITH CHECK (id = auth.uid()::text OR is_admin());

-- ============================================
-- STEP 9: SERVICE ROLE NOTE
-- ============================================

-- The service_role key automatically bypasses ALL RLS policies
-- This is handled by Supabase internally - no configuration needed

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check RLS status:
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('listings', 'bookings', 'payments', 'messages', 'conversations', 'profiles');

-- List all active policies:
SELECT tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test current user ID function:
-- SELECT current_user_id();
