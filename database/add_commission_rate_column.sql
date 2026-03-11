-- Migration: Add commission_rate and partner_earnings_thb columns to bookings table
-- Run this in Supabase SQL Editor

-- Add commission_rate column (stores the rate at time of booking)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 15.00;

-- Add partner_earnings_thb column (pre-calculated partner earnings)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS partner_earnings_thb DECIMAL(12,2);

-- Update existing bookings to calculate partner_earnings from existing data
UPDATE bookings 
SET partner_earnings_thb = price_thb - COALESCE(commission_thb, 0)
WHERE partner_earnings_thb IS NULL;

-- Calculate commission_rate from existing commission_thb where possible
UPDATE bookings 
SET commission_rate = ROUND((commission_thb / NULLIF(price_thb, 0)) * 100, 2)
WHERE commission_rate IS NULL AND price_thb > 0 AND commission_thb IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN bookings.commission_rate IS 'Commission rate (%) at time of booking creation';
COMMENT ON COLUMN bookings.partner_earnings_thb IS 'Pre-calculated partner earnings = price_thb - commission_thb';

-- Create index for reporting
CREATE INDEX IF NOT EXISTS idx_bookings_commission_rate ON bookings(commission_rate);
