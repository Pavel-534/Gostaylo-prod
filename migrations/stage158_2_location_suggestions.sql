-- Stage 158.2 — lightweight queue for unknown location terms from partner listings.
-- Backend-only (service_role); admin governance UI deferred to Stage 160.

BEGIN;

CREATE TABLE IF NOT EXISTS public.location_suggestions (
  id                      TEXT PRIMARY KEY DEFAULT ('lsug-' || gen_random_uuid()::text),
  raw_term                TEXT NOT NULL,
  kind                    TEXT NOT NULL DEFAULT 'district'
                          CHECK (kind IN ('district', 'city')),
  suggested_by_listing_id TEXT REFERENCES public.listings(id) ON DELETE SET NULL,
  country_code            TEXT,
  region_code             TEXT,
  city_code               TEXT,
  status                  TEXT NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING', 'REVIEWED', 'REJECTED')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.location_suggestions IS
  'Stage 158.2 — host-entered locations outside geo canon; PENDING until admin review (Stage 160).';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_location_suggestions_pending_term
  ON public.location_suggestions (lower(raw_term), kind)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_location_suggestions_listing
  ON public.location_suggestions (suggested_by_listing_id);

CREATE INDEX IF NOT EXISTS idx_location_suggestions_status_created
  ON public.location_suggestions (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_suggestions TO service_role;

ALTER TABLE public.location_suggestions ENABLE ROW LEVEL SECURITY;

COMMIT;
