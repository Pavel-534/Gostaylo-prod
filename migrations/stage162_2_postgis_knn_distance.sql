-- Stage 162.2 — KNN distance sort + distance_meters payload in radius RPC.
-- Replaces listings_ids_within_radius_v1 return shape (id → listing_id + distance_meters).
-- Safe to apply on top of stage162_1 (DROP + CREATE required for return type change).

BEGIN;

DROP FUNCTION IF EXISTS public.listings_ids_within_radius_v1(double precision, double precision, double precision);

CREATE OR REPLACE FUNCTION public.listings_ids_within_radius_v1(
  p_lat       double precision,
  p_lng       double precision,
  p_radius_m  double precision
)
RETURNS TABLE (
  listing_id       text,
  distance_meters  double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH target AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS geo
  )
  SELECT
    l.id AS listing_id,
    ST_Distance(l.coordinates, t.geo)::double precision AS distance_meters
  FROM public.listings AS l
  CROSS JOIN target AS t
  WHERE l.status = 'ACTIVE'
    AND l.coordinates IS NOT NULL
    AND p_radius_m > 0
    AND p_lat BETWEEN -90 AND 90
    AND p_lng BETWEEN -180 AND 180
    AND ST_DWithin(l.coordinates, t.geo, p_radius_m)
  ORDER BY l.coordinates <-> t.geo ASC;
$$;

COMMENT ON FUNCTION public.listings_ids_within_radius_v1 IS
  'Stage 162.2 — ACTIVE listings within radius (meters), KNN-ordered nearest-first; distance_meters = ST_Distance geography.';

REVOKE ALL ON FUNCTION public.listings_ids_within_radius_v1(double precision, double precision, double precision)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.listings_ids_within_radius_v1(double precision, double precision, double precision)
  TO service_role;

COMMIT;
