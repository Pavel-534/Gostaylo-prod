-- Stage 166 — Spatial/search performance: partial indexes + GiST-only bbox count.
-- Requires stage162_1 (coordinates GiST).

BEGIN;

-- Partial indexes for hot catalog paths (ACTIVE-only scans).
CREATE INDEX IF NOT EXISTS idx_listings_active_created_at
  ON public.listings (created_at DESC)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_listings_active_category_id
  ON public.listings (category_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_listings_active_lat_lng
  ON public.listings (latitude, longitude)
  WHERE status = 'ACTIVE'
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL;

-- GiST-only bbox count (replaces lat/lng range + optional intersect hybrid).
CREATE OR REPLACE FUNCTION public.listings_map_bbox_pin_count_v1(
  p_south        double precision,
  p_west         double precision,
  p_north        double precision,
  p_east         double precision,
  p_category_ids text[] DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH env AS (
    SELECT ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography AS geo
  )
  SELECT COUNT(*)::bigint
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
    );
$$;

COMMENT ON FUNCTION public.listings_map_bbox_pin_count_v1 IS
  'Stage 166 — GiST-only ACTIVE pin count in bbox (coordinates && + ST_Intersects).';

-- Admin/dev: EXPLAIN (ANALYZE) helper for slow spatial ops (service_role only).
CREATE OR REPLACE FUNCTION public.spatial_explain_bbox_gist_v1(
  p_south  double precision,
  p_west   double precision,
  p_north  double precision,
  p_east   double precision,
  p_limit  integer DEFAULT 50
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  plan text;
BEGIN
  EXECUTE format(
    $q$
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT l.id
    FROM public.listings AS l
    WHERE l.status = 'ACTIVE'
      AND l.coordinates IS NOT NULL
      AND l.coordinates && ST_MakeEnvelope(%L, %L, %L, %L, 4326)::geography
      AND ST_Intersects(l.coordinates, ST_MakeEnvelope(%L, %L, %L, %L, 4326)::geography)
    ORDER BY l.created_at DESC
    LIMIT %s
    $q$,
    p_west, p_south, p_east, p_north,
    p_west, p_south, p_east, p_north,
    GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
  ) INTO plan;
  RETURN plan;
END;
$$;

COMMENT ON FUNCTION public.spatial_explain_bbox_gist_v1 IS
  'Stage 166 — EXPLAIN ANALYZE text for GiST bbox pin lookup (slow-query diagnostics).';

REVOKE ALL ON FUNCTION public.spatial_explain_bbox_gist_v1(double precision, double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spatial_explain_bbox_gist_v1(double precision, double precision, double precision, double precision, integer) TO service_role;

COMMIT;
