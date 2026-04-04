-- INQUIRY booking status (private / group price requests)
-- Soft-hold rows on calendar_blocks (invoice payment window); expired holds ignored in app layer

DO $$
BEGIN
  ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'INQUIRY';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'booking_status value INQUIRY already exists';
END $$;

ALTER TABLE public.calendar_blocks
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.calendar_blocks.expires_at IS 'When set, block counts toward inventory only until this time (invoice soft hold)';
