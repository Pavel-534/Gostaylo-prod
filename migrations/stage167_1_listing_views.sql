-- Stage 167.1 — listing_views (server-backed recently viewed)
-- SSOT: lib/recommendations/listing-views.service.js, POST/GET /api/v2/listing-views

CREATE TABLE IF NOT EXISTS public.listing_views (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT listing_views_user_listing_unique UNIQUE (user_id, listing_id)
);

COMMENT ON TABLE public.listing_views IS
  'Per-user listing view history for discovery (recently viewed rail). Upsert on each PDP view.';

CREATE INDEX IF NOT EXISTS idx_listing_views_user_viewed_at
  ON public.listing_views (user_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_views_listing_id
  ON public.listing_views (listing_id);

-- User-scoped: authenticated via RLS; API uses service_role after session check.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_views TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_views TO service_role;

ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stage167_1_listing_views_own ON public.listing_views;
CREATE POLICY stage167_1_listing_views_own ON public.listing_views
  FOR ALL TO public
  USING (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR user_id::text = public.current_profile_id()
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR user_id::text = public.current_profile_id()
  );
