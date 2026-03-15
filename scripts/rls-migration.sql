-- ========================================
-- Phase 5.8: RLS Migration SQL Script
-- Critical Security Hardening (P0)
-- ========================================
-- 
-- IMPORTANT: Execute this SQL in Supabase Dashboard → SQL Editor
-- 
-- Security Guarantees:
-- ✅ Service Role (Admin) will bypass ALL RLS policies automatically
-- ✅ User isolation enforced at database level
-- ✅ Public marketplace functionality maintained
-- ========================================

-- 1. Enable RLS on profiles table (P0 - GDPR/Privacy Risk)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on listings table (P1 - Marketplace Security)
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PROFILES TABLE POLICIES
-- ========================================

-- Policy 1: Users can view their own profile
CREATE POLICY "users_view_own_profile"
ON profiles FOR SELECT
USING (id = auth.uid());

-- Policy 2: Users can update their own profile
CREATE POLICY "users_update_own_profile"
ON profiles FOR UPDATE
USING (id = auth.uid());

-- Policy 3: Admin users can view all profiles
CREATE POLICY "admins_view_all_profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- ========================================
-- LISTINGS TABLE POLICIES
-- ========================================

-- Policy 1: Public can view ACTIVE listings only
CREATE POLICY "public_view_active_listings"
ON listings FOR SELECT
USING (status = 'ACTIVE');

-- Policy 2: Partners can CRUD their own listings (all statuses)
CREATE POLICY "partners_manage_own_listings"
ON listings FOR ALL
USING (owner_id = auth.uid());

-- Policy 3: Admin users can view all listings
CREATE POLICY "admins_view_all_listings"
ON listings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check RLS status
SELECT 
  tablename, 
  rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'listings', 'bookings')
ORDER BY tablename;

-- List all policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as command
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'listings', 'bookings')
ORDER BY tablename, policyname;

-- ========================================
-- POST-MIGRATION TESTING
-- ========================================

-- Test 1: Service role should see all profiles
-- (Run this with Service Role Key - should return all 77+ profiles)
-- SELECT count(*) FROM profiles;

-- Test 2: Anonymous should NOT see profiles
-- (Run this with Anon Key - should return 0)
-- SELECT count(*) FROM profiles;

-- Test 3: Public should see ACTIVE listings
-- (Run this with Anon Key - should return only active listings)
-- SELECT count(*) FROM listings WHERE status = 'ACTIVE';

-- ========================================
-- ROLLBACK (if issues occur)
-- ========================================

-- ONLY RUN IF ISSUES ARISE - This disables RLS
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE listings DISABLE ROW LEVEL SECURITY;

-- DROP ALL POLICIES (if needed to start fresh)
-- DROP POLICY IF EXISTS "users_view_own_profile" ON profiles;
-- DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
-- DROP POLICY IF EXISTS "admins_view_all_profiles" ON profiles;
-- DROP POLICY IF EXISTS "public_view_active_listings" ON listings;
-- DROP POLICY IF EXISTS "partners_manage_own_listings" ON listings;
-- DROP POLICY IF EXISTS "admins_view_all_listings" ON listings;

-- ========================================
-- END OF MIGRATION SCRIPT
-- ========================================
