-- ========================================
-- CRITICAL FIX: Bookings RLS Policies
-- ========================================
-- Issue: Renters can't see bookings they just created
-- Issue: Renters can't INSERT new bookings (blocked by RLS)
-- Fix: Add SELECT and INSERT policies for renters and partners

-- Policy 1: Renters can view their own bookings
CREATE POLICY "renters_view_own_bookings"
ON bookings FOR SELECT
USING (renter_id = auth.uid());

-- Policy 2: Partners can view bookings for their listings
CREATE POLICY "partners_view_listing_bookings"
ON bookings FOR SELECT
USING (
  partner_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM listings
    WHERE listings.id = bookings.listing_id
    AND listings.owner_id = auth.uid()
  )
);

-- Policy 3: Admins can view all bookings
CREATE POLICY "admins_view_all_bookings"
ON bookings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- Policy 4: Renters can INSERT their own bookings
CREATE POLICY "renters_insert_own_bookings"
ON bookings FOR INSERT
WITH CHECK (
  renter_id = auth.uid()
  OR renter_id IS NULL  -- Allow guest (anonymous) bookings
);

-- Policy 5: Service Role bypass (automatic for all operations)
-- This is built-in to Supabase - Service Role always bypasses RLS

-- ========================================
-- Verification Query
-- ========================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as command
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'bookings'
ORDER BY policyname;
