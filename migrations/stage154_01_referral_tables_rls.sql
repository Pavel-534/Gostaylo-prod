-- Stage 154.1 — referral core tables: RLS ON, service_role only (PostgREST deny for anon/authenticated).
-- SSOT API: supabaseAdmin in Node; no direct client reads of referral_ledger / codes / relations.

ALTER TABLE IF EXISTS public.referral_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referral_relations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.referral_ledger FROM anon, authenticated;
REVOKE ALL ON TABLE public.referral_codes FROM anon, authenticated;
REVOKE ALL ON TABLE public.referral_relations FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.referral_ledger TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.referral_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.referral_relations TO service_role;

COMMENT ON TABLE public.referral_ledger IS
  'Referral transactions by booking lifecycle. Stage 154.1: RLS ON, service_role API only.';
