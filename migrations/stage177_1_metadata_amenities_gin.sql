-- Stage 177.1 — GIN index for amenities JSONB facet (unified @> filter).

BEGIN;

CREATE INDEX IF NOT EXISTS idx_listings_metadata_amenities_gin
  ON public.listings
  USING GIN ((metadata -> 'amenities') jsonb_path_ops)
  WHERE status = 'ACTIVE';

COMMENT ON INDEX public.idx_listings_metadata_amenities_gin IS
  'Stage 177.1 — fast amenities containment for discovery catalog (metadata @> amenities array).';

COMMIT;
