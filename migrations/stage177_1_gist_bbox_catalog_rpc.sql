-- Stage 177.1 — GiST bbox listing ids for unified catalog search (category-aware cascade).
-- Extends map-pins GiST path with optional category filter + higher limit for catalog prefilter.

BEGIN;

CREATE OR REPLACE FUNCTION public.listings_ids_in_bbox_gist_v1(
  p_south        double precision,
  p_west         double precision,
  p_north        double precision,
  p_east         double precision,
  p_category_ids text[] DEFAULT NULL,
  p_limit        integer DEFAULT 10000
)
RETURNS TABLE (listing_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH env AS (
    SELECT ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography AS geo
  )
  SELECT l.id AS listing_id
  FROM public.listings AS l
  CROSS JOIN env AS e
  WHERE l.status = 'ACTIVE'
    AND l.coordinates IS NOT NULL
    AND l.coordinates && e.geo
    AND ST_Intersects(l.coordinates, e.geo)
    AND (
      p_category_ids IS NULL
      OR cardinality(p_category_ids) = 0
      OR l.category_id = ANY (p_category_ids)
    )
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10000), 10000));
$$;

COMMENT ON FUNCTION public.listings_ids_in_bbox_gist_v1 IS
  'Stage 177.1 — ACTIVE listing ids in WGS84 bbox via GiST; optional category_id[] filter for discovery cascade.';

REVOKE ALL ON FUNCTION public.listings_ids_in_bbox_gist_v1(
  double precision, double precision, double precision, double precision, text[], integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.listings_ids_in_bbox_gist_v1(
  double precision, double precision, double precision, double precision, text[], integer
) TO service_role;

COMMIT;
