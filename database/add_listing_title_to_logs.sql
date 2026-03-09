-- Add listing_title column to ical_sync_logs
-- Run this in Supabase SQL Editor

ALTER TABLE ical_sync_logs 
ADD COLUMN IF NOT EXISTS listing_title TEXT;

-- Add comment
COMMENT ON COLUMN ical_sync_logs.listing_title IS 'Denormalized listing title for easier display in logs';
