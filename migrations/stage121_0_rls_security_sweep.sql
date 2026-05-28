-- Stage 121.0 — Supabase Security Advisor remediation (2026-05-27)
-- Fixes: rls_disabled_in_public, sensitive_columns_exposed (payouts, user_push_tokens),
--        rls_references_user_metadata (messages), permissive favorites policies.
-- API routes use service_role and continue to bypass RLS. Idempotent.

-- =============================================================================
-- 1) Backend-only tables: RLS ON, no anon/authenticated policies (deny by default)
-- =============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ops_job_runs',
    'promo_codes',
    'blacklist',
    'exchange_rates',
    'referrals',
    'activity_log',
    'telegram_link_codes',
    'ical_sync_logs',
    'payout_methods',
    'payouts',
    'ledger_accounts',
    'ledger_journals',
    'ledger_entries',
    'notification_outbox',
    'partner_performance_logs',
    'telegram_chat_reply_map',
    'chat_push_delivery_batch',
    'ai_usage_logs',
    'partner_sla_nudge_events',
    'critical_signal_events',
    'dispute_penalties'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      RAISE NOTICE 'stage121: RLS enabled on public.% (backend-only)', t;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- 2) categories — public read active catalog; writes staff/service only
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.categories') IS NOT NULL THEN
    ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS stage121_categories_select_active ON public.categories;
    CREATE POLICY stage121_categories_select_active ON public.categories
      FOR SELECT TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR COALESCE(is_active, true) = true
      );

    DROP POLICY IF EXISTS stage121_categories_staff_mutate ON public.categories;
    CREATE POLICY stage121_categories_staff_mutate ON public.categories
      FOR ALL TO public
      USING (auth.role() = 'service_role' OR public.is_admin())
      WITH CHECK (auth.role() = 'service_role' OR public.is_admin());
  END IF;
END $$;

-- =============================================================================
-- 3) seasonal_prices + calendar_blocks — listing owner (defense in depth)
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.seasonal_prices') IS NOT NULL THEN
    ALTER TABLE public.seasonal_prices ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS stage121_seasonal_prices_party ON public.seasonal_prices;
    CREATE POLICY stage121_seasonal_prices_party ON public.seasonal_prices
      FOR ALL TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.listings l
          WHERE l.id = seasonal_prices.listing_id
            AND l.owner_id::text = public.current_profile_id()
        )
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.listings l
          WHERE l.id = seasonal_prices.listing_id
            AND l.owner_id::text = public.current_profile_id()
        )
      );
  END IF;

  IF to_regclass('public.calendar_blocks') IS NOT NULL THEN
    ALTER TABLE public.calendar_blocks ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS stage121_calendar_blocks_party ON public.calendar_blocks;
    CREATE POLICY stage121_calendar_blocks_party ON public.calendar_blocks
      FOR ALL TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.listings l
          WHERE l.id = calendar_blocks.listing_id
            AND l.owner_id::text = public.current_profile_id()
        )
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.listings l
          WHERE l.id = calendar_blocks.listing_id
            AND l.owner_id::text = public.current_profile_id()
        )
      );
  END IF;
END $$;

-- =============================================================================
-- 4) partner_payout_profiles — partner owns profile rows (sensitive JSON in data)
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.partner_payout_profiles') IS NOT NULL THEN
    ALTER TABLE public.partner_payout_profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS stage121_partner_payout_profiles_party ON public.partner_payout_profiles;
    CREATE POLICY stage121_partner_payout_profiles_party ON public.partner_payout_profiles
      FOR ALL TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR partner_id::text = public.current_profile_id()
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR partner_id::text = public.current_profile_id()
      );
  END IF;
END $$;

-- =============================================================================
-- 5) user_push_tokens — own rows only (fixes sensitive_columns_exposed: token)
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.user_push_tokens') IS NOT NULL THEN
    ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS stage121_user_push_tokens_own ON public.user_push_tokens;
    CREATE POLICY stage121_user_push_tokens_own ON public.user_push_tokens
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
  END IF;
END $$;

-- =============================================================================
-- 6) chat_conversation_favorites — RLS + profile-scoped (TEXT user_id safe)
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.chat_conversation_favorites') IS NOT NULL THEN
    ALTER TABLE public.chat_conversation_favorites ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS chat_conv_fav_select_own ON public.chat_conversation_favorites;
    DROP POLICY IF EXISTS chat_conv_fav_insert_own ON public.chat_conversation_favorites;
    DROP POLICY IF EXISTS chat_conv_fav_delete_own ON public.chat_conversation_favorites;
    DROP POLICY IF EXISTS stage121_chat_conv_fav_select ON public.chat_conversation_favorites;
    DROP POLICY IF EXISTS stage121_chat_conv_fav_insert ON public.chat_conversation_favorites;
    DROP POLICY IF EXISTS stage121_chat_conv_fav_delete ON public.chat_conversation_favorites;

    CREATE POLICY stage121_chat_conv_fav_select ON public.chat_conversation_favorites
      FOR SELECT TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR user_id::text = public.current_profile_id()
      );

    CREATE POLICY stage121_chat_conv_fav_insert ON public.chat_conversation_favorites
      FOR INSERT TO public
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR user_id::text = public.current_profile_id()
      );

    CREATE POLICY stage121_chat_conv_fav_delete ON public.chat_conversation_favorites
      FOR DELETE TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR user_id::text = public.current_profile_id()
      );
  END IF;
END $$;

-- =============================================================================
-- 7) favorites — replace permissive / broken policies (Stage 94 pattern)
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.favorites') IS NOT NULL THEN
    ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view their own favorites" ON public.favorites;
    DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.favorites;
    DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.favorites;
    DROP POLICY IF EXISTS stage121_favorites_select_own ON public.favorites;
    DROP POLICY IF EXISTS stage121_favorites_insert_own ON public.favorites;
    DROP POLICY IF EXISTS stage121_favorites_delete_own ON public.favorites;

    CREATE POLICY stage121_favorites_select_own ON public.favorites
      FOR SELECT TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR user_id::text = public.current_profile_id()
      );

    CREATE POLICY stage121_favorites_insert_own ON public.favorites
      FOR INSERT TO public
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR user_id::text = public.current_profile_id()
      );

    CREATE POLICY stage121_favorites_delete_own ON public.favorites
      FOR DELETE TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR user_id::text = public.current_profile_id()
      );
  END IF;
END $$;

-- =============================================================================
-- 8) messages — stop using user_metadata in RLS (Security Advisor ERROR)
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admin full access" ON public.messages;
    DROP POLICY IF EXISTS stage121_messages_admin_all ON public.messages;

    CREATE POLICY stage121_messages_admin_all ON public.messages
      FOR ALL TO authenticated
      USING (auth.role() = 'service_role' OR public.is_admin())
      WITH CHECK (auth.role() = 'service_role' OR public.is_admin());
  END IF;
END $$;

COMMENT ON TABLE public.payouts IS
  'Partner payouts. RLS stage121: no public policies — API service_role only; bank_account not exposed via anon key.';
