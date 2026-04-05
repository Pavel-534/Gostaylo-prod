-- Frozen accommodation pricing at booking time (duration discount captions, nights, subtotals)

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.bookings.pricing_snapshot IS 'Snapshot at booking: nights, subtotals, duration_discount captions (v1 JSON)';
