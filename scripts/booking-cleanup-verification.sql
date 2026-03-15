-- ========================================
-- Booking Cleanup & Data Verification
-- ========================================

-- 1. Find user ID for pavel29031983@gmail.com
SELECT id, email, role FROM profiles WHERE email = 'pavel29031983@gmail.com';

-- 2. Check renter_id column data type
SELECT 
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('renter_id', 'partner_id', 'listing_id');

-- 3. View test bookings for user
SELECT 
  id,
  listing_id,
  renter_id,
  status,
  check_in,
  check_out,
  created_at
FROM bookings
WHERE renter_id = (SELECT id FROM profiles WHERE email = 'pavel29031983@gmail.com')
ORDER BY created_at DESC;

-- 4. Delete test bookings for user (CAUTION: Run only if needed)
-- DELETE FROM bookings
-- WHERE renter_id = (SELECT id FROM profiles WHERE email = 'pavel29031983@gmail.com')
--   AND status = 'PENDING'
--   AND created_at > NOW() - INTERVAL '1 day';

-- 5. Verify calendar sees bookings (this should work with Service Role)
SELECT 
  id,
  listing_id,
  check_in,
  check_out,
  status,
  guest_name
FROM bookings
WHERE listing_id IN ('lst-yacht-1773578825136', 'lst-villa-1773578825137')
  AND status IN ('PENDING', 'CONFIRMED', 'PAID')
  AND check_out >= CURRENT_DATE
ORDER BY check_in;

-- 6. Check RLS policies on bookings table
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'bookings'
ORDER BY cmd, policyname;
