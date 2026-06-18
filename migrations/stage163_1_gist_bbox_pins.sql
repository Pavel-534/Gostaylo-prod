-- Stage 163.1 — GiST bbox pin id lookup for map-pins API (uses idx_listings_coordinates).

BEGIN;

CREATE OR REPLACE FUNCTION public.listings_map_pin_ids_in_bbox_gist_v1(
  p_south  double precision,
  p_west   double precision,
  p_north  double precision,
  p_east   double precision,
  p_limit  integer DEFAULT 500
)
RETURNS TABLE (id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH env AS (
    SELECT ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography AS geo
  )
  SELECT l.id
  FROM public.listings AS l
  CROSS JOIN env AS e
  WHERE l.status = 'ACTIVE'
    AND l.coordinates IS NOT NULL
    AND l.coordinates && e.geo
    AND ST_Intersects(l.coordinates, e.geo)
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 500));
$$;

COMMENT ON FUNCTION public.listings_map_pin_ids_in_bbox_gist_v1 IS
  'Stage 163.1 — listing ids in WGS84 bbox via GiST (&& + ST_Intersects on coordinates).';

REVOKE ALL ON FUNCTION public.listings_map_pin_ids_in_bbox_gist_v1(double precision, double precision, double precision, double precision, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.listings_map_pin_ids_in_bbox_gist_v1(double precision, double precision, double precision, double precision, integer) TO service_role;

COMMIT;
