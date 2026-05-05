-- Stage 83.0 — smart category control panel:
-- 1) categories flags for coming soon / admin preview-only
-- 2) leads_waiting_list capture for coming soon demand

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_preview_only BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.categories.is_coming_soon IS
  'Stage 83.0: category visible to users with "coming soon" UX and waitlist capture.';
COMMENT ON COLUMN public.categories.is_preview_only IS
  'Stage 83.0: hidden from non-admin user-facing surfaces; visible for admin preview/testing.';

CREATE TABLE IF NOT EXISTS public.leads_waiting_list (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  category_slug TEXT,
  email TEXT NOT NULL,
  language TEXT,
  source_page TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_waiting_list_category_email
  ON public.leads_waiting_list (COALESCE(category_slug, ''), lower(email));

CREATE INDEX IF NOT EXISTS idx_leads_waiting_list_created_at
  ON public.leads_waiting_list (created_at DESC);
