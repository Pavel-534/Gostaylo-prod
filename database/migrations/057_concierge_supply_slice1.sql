-- ADR-210 / Concierge Supply Pipeline — Slice 1 (schema foundation)
-- Additive only: no listing_status enum changes.
-- Idempotent: safe to re-run.
-- Apply: Supabase SQL Editor OR linked `supabase db push` (see migrations/README.md).
--
-- Profile: backend ops + admin read (GRANT service_role; RLS is_admin SELECT / service_role write).
-- FK targets: profiles.id / listing ids are TEXT in prod (TECHNICAL_MANIFESTO §0).

-- ---------------------------------------------------------------------------
-- A) profiles — shadow partner shell
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_shadow boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shadow_claimed_at timestamptz;

COMMENT ON COLUMN public.profiles.is_shadow IS
  'ADR-210: Concierge-provisioned partner shell; true until magic claim completes.';

COMMENT ON COLUMN public.profiles.shadow_claimed_at IS
  'ADR-210: when shadow partner completed claim (password / identity).';

CREATE INDEX IF NOT EXISTS profiles_is_shadow_idx
  ON public.profiles (id)
  WHERE is_shadow = true;

-- ---------------------------------------------------------------------------
-- B) concierge_import_batches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.concierge_import_batches (
  id text PRIMARY KEY,
  partner_profile_id text NOT NULL REFERENCES public.profiles (id),
  source_type text,
  source_label text,
  mapping_profile text,
  raw_payload_storage_key text,
  status text NOT NULL DEFAULT 'open',
  created_by_admin_id text REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.concierge_import_batches IS
  'ADR-210 Slice 1: Concierge Supply import batch (ops audit + claim scope).';

CREATE INDEX IF NOT EXISTS concierge_import_batches_partner_profile_id_idx
  ON public.concierge_import_batches (partner_profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.concierge_import_batches TO service_role;

ALTER TABLE public.concierge_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS concierge_import_batches_admin_select ON public.concierge_import_batches;
CREATE POLICY concierge_import_batches_admin_select
  ON public.concierge_import_batches
  FOR SELECT
  TO public
  USING (public.is_admin());

DROP POLICY IF EXISTS concierge_import_batches_service_role_all ON public.concierge_import_batches;
CREATE POLICY concierge_import_batches_service_role_all
  ON public.concierge_import_batches
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- C) partner_claim_invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_claim_invites (
  id text PRIMARY KEY,
  batch_id text REFERENCES public.concierge_import_batches (id),
  partner_profile_id text NOT NULL REFERENCES public.profiles (id),
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  claimed_by_profile_id text REFERENCES public.profiles (id),
  created_by_admin_id text REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.partner_claim_invites IS
  'ADR-210 Slice 1: magic claim invites (store token_hash only, never raw token).';

CREATE INDEX IF NOT EXISTS partner_claim_invites_partner_unclaimed_idx
  ON public.partner_claim_invites (partner_profile_id)
  WHERE claimed_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_claim_invites TO service_role;

ALTER TABLE public.partner_claim_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_claim_invites_admin_select ON public.partner_claim_invites;
CREATE POLICY partner_claim_invites_admin_select
  ON public.partner_claim_invites
  FOR SELECT
  TO public
  USING (public.is_admin());

DROP POLICY IF EXISTS partner_claim_invites_service_role_all ON public.partner_claim_invites;
CREATE POLICY partner_claim_invites_service_role_all
  ON public.partner_claim_invites
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- D) listings — optional batch link (nullable; no enum changes)
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS concierge_batch_id text
    REFERENCES public.concierge_import_batches (id);

COMMENT ON COLUMN public.listings.concierge_batch_id IS
  'ADR-210: optional Concierge import batch; ownership remains listings.owner_id.';

CREATE INDEX IF NOT EXISTS listings_concierge_batch_id_idx
  ON public.listings (concierge_batch_id)
  WHERE concierge_batch_id IS NOT NULL;
