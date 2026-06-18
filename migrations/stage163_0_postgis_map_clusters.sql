-- Stage 163.0 — PostGIS map clustering helpers (server-side, optional path for map-pins API).
-- Requires stage162_1+ (coordinates geography + GiST).

BEGIN;

-- Fast ACTIVE pin count in bbox (uses coordinates when present, else lat/lng fallback).
CREATE OR REPLACE FUNCTION public.listings_map_bbox_pin_count_v1(
  p_south       double precision,
  p_west        double precision,
  p_north       double precision,
  p_east        double precision,
  p_category_ids text[] DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COUNT(*)::bigint
  FROM public.listings AS l
  WHERE l.status = 'ACTIVE'
    AND l.latitude IS NOT NULL
    AND l.longitude IS NOT NULL
    AND l.latitude BETWEEN p_south AND p_north
    AND l.longitude BETWEEN p_west AND p_east
    AND (
      l.coordinates IS NULL
      OR ST_Intersects(
        l.coordinates,
        ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
      )
    )
    AND (
      p_category_ids IS NULL
      OR cardinality(p_category_ids) = 0
      OR l.category_id = ANY (p_category_ids)
    );
$$;

COMMENT ON FUNCTION public.listings_map_bbox_pin_count_v1 IS
  'Stage 163 — count ACTIVE listings with coordinates in WGS84 bbox.';

-- Grid clusters via ST_SnapToGrid (Web Mercator meters) — works without ST_ClusterGrid extension.
CREATE OR REPLACE FUNCTION public.listings_map_clusters_grid_v1(
  p_south        double precision,
  p_west         double precision,
  p_north        double precision,
  p_east         double precision,
  p_cell_size_m  double precision DEFAULT 3500,
  p_category_ids text[] DEFAULT NULL
)
RETURNS TABLE (
  cluster_id     integer,
  pin_count      integer,
  centroid_lat   double precision,
  centroid_lng   double precision,
  min_price_thb  numeric,
  listing_ids    text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH bbox AS (
    SELECT
      ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326) AS env4326
  ),
  pins AS (
    SELECT
      l.id,
      l.base_price_thb,
      ST_Transform(l.coordinates::geometry, 3857) AS geom3857
    FROM public.listings AS l
    CROSS JOIN bbox AS b
    WHERE l.status = 'ACTIVE'
      AND l.coordinates IS NOT NULL
      AND ST_Intersects(l.coordinates, b.env4326::geography)
      AND (
        p_category_ids IS NULL
        OR cardinality(p_category_ids) = 0
        OR l.category_id = ANY (p_category_ids)
      )
  ),
  gridded AS (
    SELECT
      id,
      base_price_thb,
      ST_SnapToGrid(geom3857, GREATEST(p_cell_size_m, 500)) AS grid_geom
    FROM pins
  )
  SELECT
    (ROW_NUMBER() OVER (ORDER BY grid_geom))::integer AS cluster_id,
    COUNT(*)::integer AS pin_count,
    ST_Y(ST_Transform(ST_Centroid(ST_Collect(grid_geom)), 4326))::double precision AS centroid_lat,
    ST_X(ST_Transform(ST_Centroid(ST_Collect(grid_geom)), 4326))::double precision AS centroid_lng,
    MIN(base_price_thb) AS min_price_thb,
    ARRAY_AGG(id ORDER BY id) AS listing_ids
  FROM gridded
  GROUP BY grid_geom;
$$;

COMMENT ON FUNCTION public.listings_map_clusters_grid_v1 IS
  'Stage 163 — grid clusters in bbox (EPSG:3857 snap); for map-pins when density > threshold.';

REVOKE ALL ON FUNCTION public.listings_map_bbox_pin_count_v1(double precision, double precision, double precision, double precision, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listings_map_clusters_grid_v1(double precision, double precision, double precision, double precision, double precision, text[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.listings_map_bbox_pin_count_v1(double precision, double precision, double precision, double precision, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.listings_map_clusters_grid_v1(double precision, double precision, double precision, double precision, double precision, text[]) TO service_role;

COMMIT;
