-- PR-#4: bookings.check_in / check_out → TIMESTAMPTZ (listing-day start Bangkok);
-- listings.cancellation_policy enum for refunds / Ledger.

-- 1) Cancellation policy enum + column on listings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cancellation_policy') THEN
    CREATE TYPE cancellation_policy AS ENUM ('flexible', 'moderate', 'strict');
  END IF;
END $$;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS cancellation_policy cancellation_policy NOT NULL DEFAULT 'moderate';

COMMENT ON COLUMN public.listings.cancellation_policy IS 'PR-#4: refund tier for Ledger / cancellations (flexible|moderate|strict).';

UPDATE public.listings
SET cancellation_policy = CASE
  WHEN lower(trim(coalesce(metadata->>'cancellationPolicy', ''))) IN ('flexible') THEN 'flexible'::cancellation_policy
  WHEN lower(trim(coalesce(metadata->>'cancellationPolicy', ''))) IN ('strict') THEN 'strict'::cancellation_policy
  WHEN lower(trim(coalesce(metadata->>'cancellationPolicy', ''))) IN ('moderate') THEN 'moderate'::cancellation_policy
  ELSE cancellation_policy
END
WHERE metadata ? 'cancellationPolicy';

-- 2) Bookings: DATE → TIMESTAMPTZ (calendar day start in Asia/Bangkok, same occupancy semantics as before)
ALTER TABLE public.bookings
  ALTER COLUMN check_in TYPE TIMESTAMPTZ
  USING (
    ((check_in::text || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Bangkok')
  );

ALTER TABLE public.bookings
  ALTER COLUMN check_out TYPE TIMESTAMPTZ
  USING (
    ((check_out::text || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Bangkok')
  );

COMMENT ON COLUMN public.bookings.check_in IS 'Start of stay/service (listing TZ semantics; PR-#4 TIMESTAMPTZ).';
COMMENT ON COLUMN public.bookings.check_out IS 'End boundary (exclusive night model; PR-#4 TIMESTAMPTZ).';
