-- Stage 89.0 — анонимные снимки качества выдачи (доля «Verified» при majority threshold).
-- Заполняется из run-listings-search-get; читает админ (**GET /api/v2/admin/marketplace-health**).

CREATE TABLE IF NOT EXISTS public.catalog_verified_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  verified_share_approx numeric NOT NULL CHECK (verified_share_approx >= 0 AND verified_share_approx <= 1),
  verified_count integer NOT NULL CHECK (verified_count >= 0),
  result_count integer NOT NULL CHECK (result_count > 0),
  category text,
  where_hint text,
  map_bounds_filtered boolean NOT NULL DEFAULT false,
  semantic_blend boolean NOT NULL DEFAULT false,
  payload_profile text
);

CREATE INDEX IF NOT EXISTS idx_catalog_verified_snapshots_recorded
  ON public.catalog_verified_snapshots (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_verified_snapshots_where
  ON public.catalog_verified_snapshots (COALESCE(where_hint, ''));

COMMENT ON TABLE public.catalog_verified_snapshots IS 'Stage 89.0 — majority-verified catalog responses (telemetry 87.1 persisted for admin Marketplace Health).';
