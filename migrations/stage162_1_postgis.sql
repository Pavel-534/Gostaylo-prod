-- Stage 162.1 — PostGIS spatial infrastructure for listings (Wave C).
-- SSOT: coordinates geography(Point,4326) synced from latitude/longitude via trigger.
-- Search radius: ST_DWithin via listings_ids_within_radius_v1 (service_role RPC).

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) PostGIS extension (Supabase: extensions schema)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 2) Geography column on listings
-- -----------------------------------------------------------------------------
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS coordinates extensions.geography(Point, 4326);

COMMENT ON COLUMN public.listings.coordinates IS
  'Stage 162.1 — WGS84 point derived from longitude/latitude; GiST-indexed for ST_DWithin search.';

-- -----------------------------------------------------------------------------
-- 3) GiST index (partial: only rows with coordinates)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_coordinates
  ON public.listings
  USING GIST (coordinates)
  WHERE coordinates IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4) SSOT write-path: sync coordinates from lat/lng on INSERT/UPDATE
--    Explicit NULL when either coordinate is missing or out of range.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_listing_coordinates_from_latlng()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    NEW.coordinates := NULL;
  ELSIF NEW.latitude BETWEEN -90 AND 90
        AND NEW.longitude BETWEEN -180 AND 180 THEN
    NEW.coordinates := ST_SetSRID(
      ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision),
      4326
    )::geography;
  ELSE
    NEW.coordinates := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listings_sync_coordinates ON public.listings;

CREATE TRIGGER trg_listings_sync_coordinates
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_listing_coordinates_from_latlng();

-- -----------------------------------------------------------------------------
-- 5) Idempotent backfill — ACTIVE listings with valid lat/lng
-- -----------------------------------------------------------------------------
UPDATE public.listings AS l
SET coordinates = ST_SetSRID(
      ST_MakePoint(l.longitude::double precision, l.latitude::double precision),
      4326
    )::geography
WHERE l.status = 'ACTIVE'
  AND l.latitude IS NOT NULL
  AND l.longitude IS NOT NULL
  AND l.latitude BETWEEN -90 AND 90
  AND l.longitude BETWEEN -180 AND 180;

-- Hygiene: clear coordinates when lat/lng removed, NULL, or invalid
UPDATE public.listings AS l
SET coordinates = NULL
WHERE l.coordinates IS NOT NULL
  AND (
    l.latitude IS NULL
    OR l.longitude IS NULL
    OR l.latitude NOT BETWEEN -90 AND 90
    OR l.longitude NOT BETWEEN -180 AND 180
  );

-- -----------------------------------------------------------------------------
-- 6) Spatial search RPC (PostgREST cannot express ST_DWithin on geography)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listings_ids_within_radius_v1(
  p_lat       double precision,
  p_lng       double precision,
  p_radius_m  double precision
)
RETURNS TABLE (id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT l.id
  FROM public.listings AS l
  WHERE l.status = 'ACTIVE'
    AND l.coordinates IS NOT NULL
    AND p_radius_m > 0
    AND p_lat BETWEEN -90 AND 90
    AND p_lng BETWEEN -180 AND 180
    AND ST_DWithin(
      l.coordinates,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    );
$$;

COMMENT ON FUNCTION public.listings_ids_within_radius_v1 IS
  'Stage 162.1 — listing ids within radius (meters) of WGS84 point; used by catalog search API.';

REVOKE ALL ON FUNCTION public.listings_ids_within_radius_v1(double precision, double precision, double precision)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.listings_ids_within_radius_v1(double precision, double precision, double precision)
  TO service_role;

COMMIT;
