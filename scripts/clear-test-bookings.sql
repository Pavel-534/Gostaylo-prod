-- ========================================
-- Clear Test Bookings for E2E Testing
-- ========================================
-- Purpose: Remove all test bookings for user pavel29031983@gmail.com
-- to ensure clean end-to-end testing environment

-- Get the renter user ID
DO $$
DECLARE
  test_renter_id uuid;
BEGIN
  -- Find the renter by email
  SELECT id INTO test_renter_id
  FROM profiles
  WHERE email = 'pavel29031983@gmail.com';
  
  IF test_renter_id IS NULL THEN
    RAISE NOTICE 'Renter pavel29031983@gmail.com not found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found renter ID: %', test_renter_id;
  
  -- Delete all bookings for this renter
  DELETE FROM bookings
  WHERE renter_id = test_renter_id;
  
  RAISE NOTICE 'Deleted all bookings for renter: %', test_renter_id;
END $$;

-- Verification: Show remaining bookings for test users
SELECT 
  b.id,
  b.status,
  b.check_in,
  b.check_out,
  b.guest_name,
  p.email as renter_email,
  l.title as listing_title
FROM bookings b
LEFT JOIN profiles p ON b.renter_id = p.id
LEFT JOIN listings l ON b.listing_id = l.id
WHERE p.email IN ('pavel29031983@gmail.com', '86boa@mail.ru', 'pavel_534@mail.ru')
ORDER BY b.created_at DESC;
