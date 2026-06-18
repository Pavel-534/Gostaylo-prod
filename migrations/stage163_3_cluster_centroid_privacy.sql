-- Stage 163.3 — Server cluster centroids: grid cell center (not listing-weighted centroid).
-- Replaces ST_Centroid(ST_Collect(snap_point)) which collapses to snap corner ≈ near pins.
-- Requires stage163_0 (listings_map_clusters_grid_v1) + stage162_1 (coordinates).

BEGIN;

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
  WITH params AS (
    SELECT GREATEST(p_cell_size_m, 500)::double precision AS cell_m
  ),
  bbox AS (
    SELECT ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326) AS env4326
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
      p.id,
      p.base_price_thb,
      ST_SnapToGrid(p.geom3857, prm.cell_m) AS grid_corner
    FROM pins AS p
    CROSS JOIN params AS prm
  ),
  clustered AS (
    SELECT
      g.grid_corner,
      COUNT(*)::integer AS pin_count,
      MIN(g.base_price_thb) AS min_price_thb,
      ARRAY_AGG(g.id ORDER BY g.id) AS listing_ids
    FROM gridded AS g
    GROUP BY g.grid_corner
  )
  SELECT
    (ROW_NUMBER() OVER (ORDER BY c.grid_corner))::integer AS cluster_id,
    c.pin_count,
    ST_Y(
      ST_Transform(
        ST_SetSRID(
          ST_MakePoint(
            ST_X(c.grid_corner) + prm.cell_m / 2.0,
            ST_Y(c.grid_corner) + prm.cell_m / 2.0
          ),
          3857
        ),
        4326
      )
    )::double precision AS centroid_lat,
    ST_X(
      ST_Transform(
        ST_SetSRID(
          ST_MakePoint(
            ST_X(c.grid_corner) + prm.cell_m / 2.0,
            ST_Y(c.grid_corner) + prm.cell_m / 2.0
          ),
          3857
        ),
        4326
      )
    )::double precision AS centroid_lng,
    c.min_price_thb,
    c.listing_ids
  FROM clustered AS c
  CROSS JOIN params AS prm;
$$;

COMMENT ON FUNCTION public.listings_map_clusters_grid_v1 IS
  'Stage 163.3 — grid clusters in bbox; centroid = EPSG:3857 grid cell center (corner + cell_m/2), not listing-weighted ST_Centroid.';

COMMIT;
