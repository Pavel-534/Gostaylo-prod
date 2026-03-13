-- Migration: Add missing booking_status enum values
-- Date: 2026-03-14
-- Issue: 502 errors due to invalid enum values CHECKED_IN, PAID_ESCROW

-- PostgreSQL doesn't allow direct ALTER TYPE for ENUM
-- We need to add new values one by one using ALTER TYPE ... ADD VALUE

-- 1. Add CHECKED_IN status (for when guest confirms arrival)
DO $$
BEGIN
    ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'CHECKED_IN';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'booking_status value CHECKED_IN already exists';
END $$;

-- 2. Add PAID_ESCROW status (for escrow payment flow)  
DO $$
BEGIN
    ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'PAID_ESCROW';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'booking_status value PAID_ESCROW already exists';
END $$;

-- Verify the enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'booking_status'::regtype
ORDER BY enumsortorder;

-- Expected result after migration:
-- PENDING, CONFIRMED, PAID, CANCELLED, COMPLETED, REFUNDED, CHECKED_IN, PAID_ESCROW
