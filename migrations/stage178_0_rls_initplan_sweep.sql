-- Stage 178.0 — RLS InitPlan sweep (Supabase advisor auth_rls_initplan)
-- Wraps auth.role() / auth.uid() / is_admin() / current_profile_id() as scalar
-- subqueries so Postgres evaluates them once per statement (InitPlan), not per row.
-- Semantics unchanged for wrapped expressions. Idempotent.
--
-- Extra safety (Airento profile SSOT):
--   - Drop legacy favorites policies that match user_id to auth.uid()::text
--     (stage121_* already gate via current_profile_id).
--   - Invoices participant policies: auth.uid()::text → current_profile_id()
--     (conversation party columns store profiles.id, not auth.users.id).

CREATE OR REPLACE FUNCTION public._stage178_wrap_rls_expr(expr text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  e text := expr;
BEGIN
  IF e IS NULL THEN
    RETURN NULL;
  END IF;

  -- Protect already-wrapped forms, then wrap bare calls, then restore.
  e := replace(e, '(SELECT public.is_admin())', '__S178_IS_ADMIN__');
  e := replace(e, '(SELECT is_admin())', '__S178_IS_ADMIN__');
  e := replace(e, 'public.is_admin()', '__S178_IS_ADMIN_BARE__');
  e := replace(e, 'is_admin()', '(SELECT public.is_admin())');
  e := replace(e, '__S178_IS_ADMIN_BARE__', '(SELECT public.is_admin())');
  e := replace(e, '__S178_IS_ADMIN__', '(SELECT public.is_admin())');

  e := replace(e, '(SELECT public.current_profile_id())', '__S178_CPID__');
  e := replace(e, '(SELECT current_profile_id())', '__S178_CPID__');
  e := replace(e, 'public.current_profile_id()', '__S178_CPID_BARE__');
  e := replace(e, 'current_profile_id()', '(SELECT public.current_profile_id())');
  e := replace(e, '__S178_CPID_BARE__', '(SELECT public.current_profile_id())');
  e := replace(e, '__S178_CPID__', '(SELECT public.current_profile_id())');

  e := replace(e, '(SELECT auth.role())', '__S178_ROLE__');
  e := replace(e, 'auth.role()', '(SELECT auth.role())');
  e := replace(e, '__S178_ROLE__', '(SELECT auth.role())');

  e := replace(e, '(SELECT auth.uid())', '__S178_UID__');
  e := replace(e, 'auth.uid()', '(SELECT auth.uid())');
  e := replace(e, '__S178_UID__', '(SELECT auth.uid())');

  RETURN e;
END;
$$;

DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  role_csv text;
  cmd_sql text;
  using_sql text;
  check_sql text;
  as_sql text;
  ddl text;
  changed int := 0;
BEGIN
  -- 1) Legacy favorites: wrong id space (auth.uid vs profiles.id)
  IF to_regclass('public.favorites') IS NOT NULL THEN
    DROP POLICY IF EXISTS users_view_own_favorites ON public.favorites;
    DROP POLICY IF EXISTS users_insert_own_favorites ON public.favorites;
    DROP POLICY IF EXISTS users_delete_own_favorites ON public.favorites;
    DROP POLICY IF EXISTS admins_view_all_favorites ON public.favorites;
  END IF;

  -- 2) Invoices: party columns are profile ids
  IF to_regclass('public.invoices') IS NOT NULL THEN
    DROP POLICY IF EXISTS invoices_select_conversation_participants ON public.invoices;
    CREATE POLICY invoices_select_conversation_participants ON public.invoices
      FOR SELECT TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.conversations c
          WHERE c.id = invoices.conversation_id
            AND (
              c.owner_id = (SELECT public.current_profile_id())
              OR c.partner_id = (SELECT public.current_profile_id())
              OR c.renter_id = (SELECT public.current_profile_id())
              OR c.admin_id = (SELECT public.current_profile_id())
            )
        )
      );

    DROP POLICY IF EXISTS invoices_insert_participants ON public.invoices;
    CREATE POLICY invoices_insert_participants ON public.invoices
      FOR INSERT TO public
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.conversations c
          WHERE c.id = invoices.conversation_id
            AND (
              c.owner_id = (SELECT public.current_profile_id())
              OR c.partner_id = (SELECT public.current_profile_id())
            )
        )
      );

    DROP POLICY IF EXISTS invoices_update_participants ON public.invoices;
    CREATE POLICY invoices_update_participants ON public.invoices
      FOR UPDATE TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.conversations c
          WHERE c.id = invoices.conversation_id
            AND (
              c.owner_id = (SELECT public.current_profile_id())
              OR c.partner_id = (SELECT public.current_profile_id())
              OR c.renter_id = (SELECT public.current_profile_id())
            )
        )
      );
  END IF;

  -- 3) Wrap remaining advisor-flagged tables
  FOR r IN
    SELECT
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'user_wallets',
        'wallet_transactions',
        'concierge_import_batches',
        'partner_claim_invites',
        'payments',
        'disputes',
        'referral_program_stats',
        'guest_reviews',
        'favorites',
        'messages',
        'conversations',
        'reviews',
        'profiles',
        'listings',
        'bookings',
        'system_settings',
        'categories',
        'seasonal_prices',
        'calendar_blocks',
        'partner_payout_profiles',
        'user_push_tokens',
        'chat_conversation_favorites',
        'finance_bank_reconciliation_entries',
        'listing_views',
        'profile_auth_identities'
      ])
  LOOP
    new_qual := public._stage178_wrap_rls_expr(r.qual);
    new_check := public._stage178_wrap_rls_expr(r.with_check);

    IF new_qual IS NOT DISTINCT FROM r.qual AND new_check IS NOT DISTINCT FROM r.with_check THEN
      CONTINUE;
    END IF;

    role_csv := (
      SELECT string_agg(quote_ident(x), ', ')
      FROM unnest(r.roles) AS x
    );
    IF role_csv IS NULL OR role_csv = '' THEN
      role_csv := 'public';
    END IF;

    as_sql := CASE upper(r.permissive)
      WHEN 'RESTRICTIVE' THEN 'AS RESTRICTIVE'
      ELSE 'AS PERMISSIVE'
    END;

    cmd_sql := CASE upper(r.cmd)
      WHEN 'SELECT' THEN 'FOR SELECT'
      WHEN 'INSERT' THEN 'FOR INSERT'
      WHEN 'UPDATE' THEN 'FOR UPDATE'
      WHEN 'DELETE' THEN 'FOR DELETE'
      ELSE 'FOR ALL'
    END;

    using_sql := CASE WHEN new_qual IS NOT NULL THEN format('USING (%s)', new_qual) ELSE '' END;
    check_sql := CASE WHEN new_check IS NOT NULL THEN format('WITH CHECK (%s)', new_check) ELSE '' END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);

    ddl := format(
      'CREATE POLICY %I ON public.%I %s %s TO %s %s %s',
      r.policyname,
      r.tablename,
      as_sql,
      cmd_sql,
      role_csv,
      using_sql,
      check_sql
    );
    EXECUTE ddl;
    changed := changed + 1;
  END LOOP;

  RAISE NOTICE 'stage178.0: rewritten % policies with InitPlan wrappers', changed;
END $$;

DROP FUNCTION IF EXISTS public._stage178_wrap_rls_expr(text);
