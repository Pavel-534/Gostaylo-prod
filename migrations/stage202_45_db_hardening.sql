-- =============================================================================
-- Stage 202.45 — DB hardening (safe): hot-path FK indexes + RLS policy split +
-- SECURITY DEFINER EXECUTE / view grants (no unused-index drops).
--
-- Safe by design:
-- - ADD indexes only (no DROP INDEX of "unused" advisor hits — those can be rare paths).
-- - categories: FOR ALL staff policy → INSERT/UPDATE/DELETE only (fixes dual SELECT).
-- - messages: drop redundant admin FOR ALL (own policies already include is_admin);
--   keep admin DELETE.
-- - Revoke anon/authenticated EXECUTE on admin/service RPCs that app calls via service_role.
-- - referral_shadow_l2_monthly: re-assert service_role-only SELECT (anon had leaked SELECT).
-- - listings_public_catalog / booking_reviews stay SECURITY DEFINER + barrier intentionally
--   (anon has no SELECT on base listings — ADR-163).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Hot-path FK covering indexes (advisor unindexed_foreign_keys — money/chat ops)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payout_batch_items_batch_id
  ON public.payout_batch_items (batch_id);

CREATE INDEX IF NOT EXISTS idx_payout_batch_items_booking_id
  ON public.payout_batch_items (booking_id);

CREATE INDEX IF NOT EXISTS idx_payout_batch_items_partner_id
  ON public.payout_batch_items (partner_id);

CREATE INDEX IF NOT EXISTS idx_payout_batch_items_ledger_journal_id
  ON public.payout_batch_items (ledger_journal_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id
  ON public.wallet_transactions (wallet_id);

CREATE INDEX IF NOT EXISTS idx_disputes_against_user_id
  ON public.disputes (against_user_id);

CREATE INDEX IF NOT EXISTS idx_disputes_closed_by
  ON public.disputes (closed_by);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_partner_id
  ON public.ledger_accounts (partner_id);

CREATE INDEX IF NOT EXISTS idx_payment_intents_created_by
  ON public.payment_intents (created_by);

CREATE INDEX IF NOT EXISTS idx_payouts_payout_method_id
  ON public.payouts (payout_method_id);

CREATE INDEX IF NOT EXISTS idx_payouts_payout_profile_id
  ON public.payouts (payout_profile_id);

CREATE INDEX IF NOT EXISTS idx_referral_relations_referral_code_id
  ON public.referral_relations (referral_code_id);

CREATE INDEX IF NOT EXISTS idx_system_settings_updated_by
  ON public.system_settings (updated_by);

-- Flash-sale cron window (Stage 202.44 query shape)
CREATE INDEX IF NOT EXISTS idx_promo_codes_flash_sale_window
  ON public.promo_codes (valid_until)
  WHERE is_flash_sale = true AND is_active = true AND created_by_type = 'PARTNER';

-- -----------------------------------------------------------------------------
-- 2) categories RLS — one SELECT policy; staff mutate without SELECT overlap
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.categories') IS NULL THEN
    RAISE NOTICE 'stage202.45: categories missing — skip RLS';
    RETURN;
  END IF;

  ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS stage121_categories_select_active ON public.categories;
  CREATE POLICY stage121_categories_select_active ON public.categories
    FOR SELECT TO public
    USING (
      (SELECT auth.role()) = 'service_role'
      OR (SELECT public.is_admin())
      OR COALESCE(is_active, true) = true
    );

  DROP POLICY IF EXISTS stage121_categories_staff_mutate ON public.categories;
  DROP POLICY IF EXISTS stage202_45_categories_staff_insert ON public.categories;
  DROP POLICY IF EXISTS stage202_45_categories_staff_update ON public.categories;
  DROP POLICY IF EXISTS stage202_45_categories_staff_delete ON public.categories;

  CREATE POLICY stage202_45_categories_staff_insert ON public.categories
    FOR INSERT TO public
    WITH CHECK (
      (SELECT auth.role()) = 'service_role'
      OR (SELECT public.is_admin())
    );

  CREATE POLICY stage202_45_categories_staff_update ON public.categories
    FOR UPDATE TO public
    USING (
      (SELECT auth.role()) = 'service_role'
      OR (SELECT public.is_admin())
    )
    WITH CHECK (
      (SELECT auth.role()) = 'service_role'
      OR (SELECT public.is_admin())
    );

  CREATE POLICY stage202_45_categories_staff_delete ON public.categories
    FOR DELETE TO public
    USING (
      (SELECT auth.role()) = 'service_role'
      OR (SELECT public.is_admin())
    );
END $$;

-- -----------------------------------------------------------------------------
-- 3) messages RLS — drop redundant admin FOR ALL (own policies already allow admin)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.messages') IS NULL THEN
    RAISE NOTICE 'stage202.45: messages missing — skip RLS';
    RETURN;
  END IF;

  ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS stage121_messages_admin_all ON public.messages;
  DROP POLICY IF EXISTS stage202_45_messages_admin_delete ON public.messages;

  -- Own select/insert/update policies already include is_admin() + service_role.
  -- Keep DELETE for staff (was covered by FOR ALL).
  CREATE POLICY stage202_45_messages_admin_delete ON public.messages
    FOR DELETE TO authenticated
    USING (
      (SELECT auth.role()) = 'service_role'
      OR (SELECT public.is_admin())
    );
END $$;

-- -----------------------------------------------------------------------------
-- 4) View grants — referral shadow must not be anon-readable
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.referral_shadow_l2_monthly') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.referral_shadow_l2_monthly FROM PUBLIC;
    REVOKE ALL ON TABLE public.referral_shadow_l2_monthly FROM anon;
    REVOKE ALL ON TABLE public.referral_shadow_l2_monthly FROM authenticated;
    GRANT SELECT ON TABLE public.referral_shadow_l2_monthly TO service_role;
  END IF;
END $$;

-- Keep catalog/reviews as intentional owner-invoker views (security_barrier where set).
COMMENT ON VIEW public.listings_public_catalog IS
  'Stage 168.0 / 202.45 — anon catalog read-path (fuzzed coords). SECURITY DEFINER/owner intentional: anon has no SELECT on base listings (ADR-163).';

-- -----------------------------------------------------------------------------
-- 5) SECURITY DEFINER RPC — revoke client EXECUTE; app uses supabaseAdmin
--    Keep RLS helpers: is_admin, current_profile_id, current_user_id, storage_can_*.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid,
           n.nspname,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY (ARRAY[
        'admin_contact_leak_top_violators',
        'increment_contact_leak_strikes',
        'purge_test_ledger_rows',
        'resolve_location_suggestion_merge_v1',
        'set_listing_embedding',
        'listings_geo_drift_scan_v1',
        'spatial_explain_bbox_gist_v1',
        'rpc_chat_conversations_favorites_page',
        'listing_public_fuzz_coordinates',
        'listings_ids_in_bbox_gist_v1',
        'listings_ids_within_radius_v1',
        'listings_map_bbox_pin_count_v1',
        'listings_map_clusters_grid_v1',
        'listings_map_pin_ids_in_bbox_gist_v1',
        'listings_within_polygon_v1',
        'listings_location_inventory_counts_v1',
        'count_listings_for_location_term_v1'
      ])
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC',
      r.nspname, r.proname, r.args
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM anon',
      r.nspname, r.proname, r.args
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM authenticated',
      r.nspname, r.proname, r.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      r.nspname, r.proname, r.args
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 6) Trigger-only SECURITY DEFINER — revoke client RPC entry (Stage 202.45b)
--    Triggers still fire as table owner; clients must not call via /rest/v1/rpc.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY (ARRAY[
        'audit_booking_row',
        'audit_payment_row',
        'bump_conversation_last_message',
        'delete_listing_storage_on_row_delete',
        'handle_new_user',
        'ledger_stamp_deleted_booking_id',
        'trg_referral_relations_insert_team_joined'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC', r.nspname, r.proname, r.args);
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM anon', r.nspname, r.proname, r.args);
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM authenticated', r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', r.nspname, r.proname, r.args);
  END LOOP;
END $$;
