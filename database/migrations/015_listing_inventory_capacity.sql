-- Inventory-based booking: capacity, party size, partial manual blocks

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS max_capacity INTEGER NOT NULL DEFAULT 1
  CHECK (max_capacity >= 1);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guests_count INTEGER NOT NULL DEFAULT 1
  CHECK (guests_count >= 1);

ALTER TABLE public.calendar_blocks
  ADD COLUMN IF NOT EXISTS units_blocked INTEGER NOT NULL DEFAULT 1
  CHECK (units_blocked >= 1);

COMMENT ON COLUMN public.listings.max_capacity IS 'Concurrent spots (tour/yacht seats, vehicles, or 1 for single-unit property)';
COMMENT ON COLUMN public.bookings.guests_count IS 'Party size / seats claimed for this booking';
COMMENT ON COLUMN public.calendar_blocks.units_blocked IS 'Spots removed by this block (manual partial block or 1 for iCal slice)';
