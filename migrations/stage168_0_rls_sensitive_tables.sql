-- Stage 168.0 P0-4 — RLS + service_role-only for post-121 sensitive tables.
-- SSOT pattern: migrations/stage154_01_referral_tables_rls.sql

ALTER TABLE IF EXISTS public.referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketing_promo_tank_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads_waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referral_team_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.referral_attributions FROM anon, authenticated;
REVOKE ALL ON TABLE public.marketing_promo_tank_ledger FROM anon, authenticated;
REVOKE ALL ON TABLE public.leads_waiting_list FROM anon, authenticated;
REVOKE ALL ON TABLE public.referral_team_events FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.referral_attributions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_promo_tank_ledger TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leads_waiting_list TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.referral_team_events TO service_role;

COMMENT ON TABLE public.referral_attributions IS
  'Referral click attribution (PII hashes). Stage 168.0: RLS ON, service_role API only.';
COMMENT ON TABLE public.marketing_promo_tank_ledger IS
  'Marketing promo pot ledger. Stage 168.0: RLS ON, service_role API only.';
COMMENT ON TABLE public.leads_waiting_list IS
  'Category waitlist emails. Stage 168.0: RLS ON, service_role API only.';
COMMENT ON TABLE public.referral_team_events IS
  'Referral team feed events. Stage 168.0: RLS ON, service_role API only.';
