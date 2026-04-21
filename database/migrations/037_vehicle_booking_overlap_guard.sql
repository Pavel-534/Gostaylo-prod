-- Stage 2: hard guard against overlapping vehicle bookings (race-condition protection).
-- Binary inventory rule: one vehicle unit cannot have overlapping bookings.

CREATE OR REPLACE FUNCTION public.gostaylo_is_vehicle_listing(p_listing_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(LOWER(c.slug), '') = 'vehicles'
      OR COALESCE(LOWER(l.metadata->>'category_slug'), '') = 'vehicles'
      OR COALESCE(LOWER(l.metadata->>'categorySlug'), '') = 'vehicles'
  FROM public.listings l
  LEFT JOIN public.categories c ON c.id = l.category_id
  WHERE l.id = p_listing_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.gostaylo_guard_vehicle_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  overlaps_exists BOOLEAN;
BEGIN
  IF NEW.listing_id IS NULL OR NOT public.gostaylo_is_vehicle_listing(NEW.listing_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.check_in IS NULL OR NEW.check_out IS NULL OR NEW.check_out <= NEW.check_in THEN
    RAISE EXCEPTION 'VEHICLE_INTERVAL_CONFLICT_INVALID_RANGE'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(UPPER(NEW.status::text), '') NOT IN (
    'PENDING', 'INQUIRY', 'CONFIRMED', 'AWAITING_PAYMENT', 'PAID', 'PAID_ESCROW', 'CHECKED_IN'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.listing_id = NEW.listing_id
      AND b.id <> COALESCE(NEW.id, '')
      AND COALESCE(UPPER(b.status::text), '') IN (
        'PENDING', 'INQUIRY', 'CONFIRMED', 'AWAITING_PAYMENT', 'PAID', 'PAID_ESCROW', 'CHECKED_IN'
      )
      AND tstzrange(b.check_in, b.check_out, '[)') && tstzrange(NEW.check_in, NEW.check_out, '[)')
    LIMIT 1
  ) INTO overlaps_exists;

  IF overlaps_exists THEN
    RAISE EXCEPTION 'VEHICLE_INTERVAL_CONFLICT'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gostaylo_guard_vehicle_overlap ON public.bookings;
CREATE TRIGGER trg_gostaylo_guard_vehicle_overlap
BEFORE INSERT OR UPDATE OF listing_id, check_in, check_out, status
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.gostaylo_guard_vehicle_overlap();

CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_overlap_guard
  ON public.bookings (listing_id, check_in, check_out);

