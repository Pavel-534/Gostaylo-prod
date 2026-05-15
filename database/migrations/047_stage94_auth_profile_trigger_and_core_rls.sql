-- Stage 94.0 — P0 database hardening:
-- Bookings «guest» column: prefers `renter_id`, else `user_id`, else `guest_id` (detected at apply time).
-- Reviews «reviewer» column: prefers `user_id`, else `renter_id`.
-- Prerequisites (run before this file if missing): `database/migrations/022_realtime_profile_claim_rls.sql`,
-- `026_financial_module_phase1_alignment.sql` (preferred_payout_currency_type), `stage79_0_profiles_oauth_bridge.sql`,
-- `migrations/stage82_0_profiles_terms_acceptance_alias.sql` (terms_* columns).
--
-- 1) Mirror auth.users → public.profiles (OAuth / magic-link safety net).
-- 2) Fix public.current_profile_id() fallback: map Supabase auth.uid() → profiles.id via auth_user_id (TEXT ids).
-- 3) Tighten RLS on profiles, listings, bookings; add RLS for wallets, commissions, disputes, guest_reviews.
--
-- Apply on Supabase (postgres). Service role continues to bypass RLS for API routes.
-- Requires prior migrations: 022 (current_profile_id), stage79 (auth_user_id), stage82 (terms columns).

-- =============================================================================
-- A) current_profile_id — resolve app JWT claim OR auth.users → profiles.auth_user_id
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  claims jsonb;
  pid text;
  v_auth text;
BEGIN
  BEGIN
    claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    claims := NULL;
  END;

  pid := NULLIF(BTRIM(COALESCE(claims->>'profile_id', claims->>'userId', claims->>'user_id', '')), '');
  IF pid IS NOT NULL THEN
    RETURN pid;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_auth := auth.uid()::text;
    SELECT p.id
      INTO pid
    FROM public.profiles p
    WHERE p.auth_user_id IS NOT NULL
      AND btrim(p.auth_user_id) <> ''
      AND p.auth_user_id = v_auth
    LIMIT 1;
    IF pid IS NOT NULL THEN
      RETURN pid;
    END IF;
    -- Legacy: profile.id accidentally equal to auth uuid (rare)
    SELECT p.id INTO pid FROM public.profiles p WHERE p.id = v_auth LIMIT 1;
    IF pid IS NOT NULL THEN
      RETURN pid;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.current_profile_id() IS
  'Stage 94.0: profile id from custom JWT (userId) or profiles.auth_user_id = auth.uid(); never assume auth.uid()::text is profiles.id.';

-- =============================================================================
-- B) auth.users → profiles (SECURITY DEFINER; minimal row; app/OAuth enriches)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth text;
  v_email text;
  v_pid text;
  v_ref text;
  v_fn text;
  v_ln text;
  v_meta jsonb;
  v_full text;
  parts text[];
BEGIN
  v_auth := NEW.id::text;
  v_email := NULLIF(lower(trim(COALESCE(NEW.email, ''))), '');

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id IS NOT NULL AND btrim(p.auth_user_id) <> '' AND p.auth_user_id = v_auth) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE lower(trim(p.email)) = v_email AND COALESCE(p.is_banned, false) = true) THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles p
  SET
    auth_user_id = v_auth,
    updated_at = now()
  WHERE lower(trim(p.email)) = v_email
    AND (p.auth_user_id IS NULL OR btrim(p.auth_user_id) = '')
    AND COALESCE(p.is_banned, false) = false;

  IF FOUND THEN
    RETURN NEW;
  END IF;

  v_pid := 'user-' || to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MSUS') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);

  v_ref := 'AIR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  WHILE EXISTS (SELECT 1 FROM public.profiles x WHERE x.referral_code = v_ref) LOOP
    v_ref := 'AIR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  END LOOP;

  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_fn := NULLIF(trim(COALESCE(v_meta->>'given_name', v_meta->>'first_name', '')), '');
  v_ln := NULLIF(trim(COALESCE(v_meta->>'family_name', v_meta->>'last_name', '')), '');
  v_full := NULLIF(trim(COALESCE(v_meta->>'full_name', v_meta->>'name', '')), '');
  IF (v_fn IS NULL AND v_ln IS NULL) AND v_full IS NOT NULL THEN
    parts := regexp_split_to_array(trim(v_full), '\s+');
    v_fn := COALESCE(parts[1], v_full);
    IF array_length(parts, 1) > 1 THEN
      v_ln := trim(substring(v_full from length(parts[1]) + 2));
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    password_hash,
    auth_user_id,
    role,
    first_name,
    last_name,
    referral_code,
    referred_by,
    is_verified,
    verification_status,
    preferred_currency,
    preferred_payout_currency,
    language,
    terms_accepted,
    terms_accepted_at,
    legal_terms_accepted_at,
    avatar,
    created_at,
    updated_at
  )
  VALUES (
    v_pid,
    v_email,
    NULL,
    v_auth,
    'RENTER'::public.user_role,
    v_fn,
    v_ln,
    v_ref,
    NULL,
    false,
    'PENDING'::public.verification_status,
    'THB'::public.currency_type,
    'THB'::public.preferred_payout_currency_type,
    'ru',
    false,
    NULL,
    NULL,
    NULLIF(trim(COALESCE(v_meta->>'avatar_url', v_meta->>'picture', '')), ''),
    now(),
    now()
  );

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Stage 94.0: AFTER INSERT on auth.users — link existing email profile or insert minimal RENTER row with auth_user_id.';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
  END IF;
END $grant$;

-- =============================================================================
-- C) RLS — profiles
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;

CREATE POLICY profiles_select_self_or_admin
  ON public.profiles
  FOR SELECT
  TO public
  USING (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR id = public.current_profile_id()
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;

CREATE POLICY profiles_update_self_or_admin
  ON public.profiles
  FOR UPDATE
  TO public
  USING (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR id = public.current_profile_id()
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR id = public.current_profile_id()
  );

-- =============================================================================
-- D) RLS — listings
-- =============================================================================

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listings_select_public" ON public.listings;
DROP POLICY IF EXISTS "listings_select_policy" ON public.listings;
DROP POLICY IF EXISTS listings_select_catalog_or_owner ON public.listings;

CREATE POLICY listings_select_catalog_or_owner
  ON public.listings
  FOR SELECT
  TO public
  USING (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR owner_id = public.current_profile_id()
    OR status = 'ACTIVE'::public.listing_status
  );

DROP POLICY IF EXISTS "listings_insert_owner" ON public.listings;
DROP POLICY IF EXISTS "listings_insert_policy" ON public.listings;
DROP POLICY IF EXISTS listings_insert_owner_profile ON public.listings;

CREATE POLICY listings_insert_owner_profile
  ON public.listings
  FOR INSERT
  TO public
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR owner_id = public.current_profile_id()
  );

DROP POLICY IF EXISTS "listings_update_owner" ON public.listings;
DROP POLICY IF EXISTS "listings_update_policy" ON public.listings;
DROP POLICY IF EXISTS listings_update_owner_or_admin ON public.listings;

CREATE POLICY listings_update_owner_or_admin
  ON public.listings
  FOR UPDATE
  TO public
  USING (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR owner_id = public.current_profile_id()
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR owner_id = public.current_profile_id()
  );

DROP POLICY IF EXISTS "listings_delete_owner" ON public.listings;
DROP POLICY IF EXISTS "listings_delete_policy" ON public.listings;
DROP POLICY IF EXISTS listings_delete_owner_or_admin ON public.listings;

CREATE POLICY listings_delete_owner_or_admin
  ON public.listings
  FOR DELETE
  TO public
  USING (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR owner_id = public.current_profile_id()
  );

-- =============================================================================
-- E) RLS — bookings (party column: renter_id, else user_id, else guest_id; optional partner_id; listing owner)
-- =============================================================================

DO $$
DECLARE
  v_renter_col text;
  v_has_partner boolean;
BEGIN
  SELECT c.column_name INTO v_renter_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'bookings'
    AND c.column_name IN ('renter_id', 'user_id', 'guest_id')
  ORDER BY
    CASE c.column_name
      WHEN 'renter_id' THEN 1
      WHEN 'user_id' THEN 2
      WHEN 'guest_id' THEN 3
    END
  LIMIT 1;

  IF v_renter_col IS NULL THEN
    RAISE EXCEPTION
      'Stage 047: public.bookings has no party column (need one of: renter_id, user_id, guest_id)';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'partner_id'
  ) INTO v_has_partner;

  ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "bookings_select_own" ON public.bookings;
  DROP POLICY IF EXISTS "bookings_select_policy" ON public.bookings;
  DROP POLICY IF EXISTS bookings_select_party ON public.bookings;
  DROP POLICY IF EXISTS "bookings_insert_auth" ON public.bookings;
  DROP POLICY IF EXISTS "bookings_insert_policy" ON public.bookings;
  DROP POLICY IF EXISTS bookings_insert_as_renter ON public.bookings;
  DROP POLICY IF EXISTS "bookings_update_own" ON public.bookings;
  DROP POLICY IF EXISTS "bookings_update_policy" ON public.bookings;
  DROP POLICY IF EXISTS bookings_update_party ON public.bookings;

  IF v_has_partner THEN
    EXECUTE format($sql$
      CREATE POLICY bookings_select_party ON public.bookings
      FOR SELECT TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
        OR partner_id = public.current_profile_id()
        OR EXISTS (
          SELECT 1 FROM public.listings l
          WHERE l.id = listing_id AND l.owner_id = public.current_profile_id()
        )
      )
    $sql$, v_renter_col);

    EXECUTE format($sql$
      CREATE POLICY bookings_insert_as_renter ON public.bookings
      FOR INSERT TO public
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
      )
    $sql$, v_renter_col);

    EXECUTE format($sql$
      CREATE POLICY bookings_update_party ON public.bookings
      FOR UPDATE TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
        OR partner_id = public.current_profile_id()
        OR EXISTS (
          SELECT 1 FROM public.listings l
          WHERE l.id = listing_id AND l.owner_id = public.current_profile_id()
        )
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
        OR partner_id = public.current_profile_id()
        OR EXISTS (
          SELECT 1 FROM public.listings l
          WHERE l.id = listing_id AND l.owner_id = public.current_profile_id()
        )
      )
    $sql$, v_renter_col, v_renter_col);
  ELSE
    EXECUTE format($sql$
      CREATE POLICY bookings_select_party ON public.bookings
      FOR SELECT TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
        OR EXISTS (
          SELECT 1 FROM public.listings l
          WHERE l.id = listing_id AND l.owner_id = public.current_profile_id()
        )
      )
    $sql$, v_renter_col);

    EXECUTE format($sql$
      CREATE POLICY bookings_insert_as_renter ON public.bookings
      FOR INSERT TO public
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
      )
    $sql$, v_renter_col);

    EXECUTE format($sql$
      CREATE POLICY bookings_update_party ON public.bookings
      FOR UPDATE TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
        OR EXISTS (
          SELECT 1 FROM public.listings l
          WHERE l.id = listing_id AND l.owner_id = public.current_profile_id()
        )
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
        OR EXISTS (
          SELECT 1 FROM public.listings l
          WHERE l.id = listing_id AND l.owner_id = public.current_profile_id()
        )
      )
    $sql$, v_renter_col, v_renter_col);
  END IF;
END $$;

-- =============================================================================
-- F) RLS — wallets (read own row only; mutations via service_role / RPC)
-- =============================================================================

ALTER TABLE IF EXISTS public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_wallets_select_own ON public.user_wallets;
DROP POLICY IF EXISTS user_wallets_mutate_service ON public.user_wallets;
DROP POLICY IF EXISTS user_wallets_insert_service ON public.user_wallets;
DROP POLICY IF EXISTS user_wallets_update_service ON public.user_wallets;
DROP POLICY IF EXISTS user_wallets_delete_service ON public.user_wallets;
CREATE POLICY user_wallets_select_own
  ON public.user_wallets
  FOR SELECT
  TO public
  USING (
    auth.role() = 'service_role'
    OR user_id = public.current_profile_id()
  );

CREATE POLICY user_wallets_insert_service
  ON public.user_wallets
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY user_wallets_update_service
  ON public.user_wallets
  FOR UPDATE
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY user_wallets_delete_service
  ON public.user_wallets
  FOR DELETE
  TO public
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS wallet_transactions_mutate_service ON public.wallet_transactions;
DROP POLICY IF EXISTS wallet_transactions_select_own ON public.wallet_transactions;
DROP POLICY IF EXISTS wallet_transactions_insert_service ON public.wallet_transactions;
DROP POLICY IF EXISTS wallet_transactions_update_service ON public.wallet_transactions;
DROP POLICY IF EXISTS wallet_transactions_delete_service ON public.wallet_transactions;
CREATE POLICY wallet_transactions_select_own
  ON public.wallet_transactions
  FOR SELECT
  TO public
  USING (
    auth.role() = 'service_role'
    OR user_id = public.current_profile_id()
  );

CREATE POLICY wallet_transactions_insert_service
  ON public.wallet_transactions
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY wallet_transactions_update_service
  ON public.wallet_transactions
  FOR UPDATE
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY wallet_transactions_delete_service
  ON public.wallet_transactions
  FOR DELETE
  TO public
  USING (auth.role() = 'service_role');

-- =============================================================================
-- G) RLS — commissions (partner sees own; admin all; service all)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'commissions') THEN
    ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS commissions_select_scope ON public.commissions;
    CREATE POLICY commissions_select_scope
      ON public.commissions
      FOR SELECT
      TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR partner_id = public.current_profile_id()
      );
    DROP POLICY IF EXISTS commissions_mutate_service ON public.commissions;
    CREATE POLICY commissions_mutate_service
      ON public.commissions
      FOR ALL
      TO public
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- =============================================================================
-- G2) RLS — payments (booking party + admin + service)
-- =============================================================================

DO $$
DECLARE
  v_renter_col text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
    RETURN;
  END IF;

  SELECT c.column_name INTO v_renter_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'bookings'
    AND c.column_name IN ('renter_id', 'user_id', 'guest_id')
  ORDER BY
    CASE c.column_name
      WHEN 'renter_id' THEN 1
      WHEN 'user_id' THEN 2
      WHEN 'guest_id' THEN 3
    END
  LIMIT 1;

  IF v_renter_col IS NULL THEN
    RAISE EXCEPTION
      'Stage 047 (payments): public.bookings has no party column (renter_id / user_id / guest_id)';
  END IF;

  ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
  DROP POLICY IF EXISTS payments_select_scope ON public.payments;
  DROP POLICY IF EXISTS "payments_insert_auth" ON public.payments;
  DROP POLICY IF EXISTS payments_insert_scope ON public.payments;
  DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;
  DROP POLICY IF EXISTS payments_update_scope ON public.payments;

  EXECUTE format($sql$
    CREATE POLICY payments_select_scope
      ON public.payments
      FOR SELECT
      TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = booking_id
              AND (
                b.%I = public.current_profile_id()
                OR EXISTS (
                  SELECT 1 FROM public.listings l
                  WHERE l.id = b.listing_id AND l.owner_id = public.current_profile_id()
                )
              )
          )
      )
  $sql$, v_renter_col);

  EXECUTE format($sql$
    CREATE POLICY payments_insert_scope
      ON public.payments
      FOR INSERT
      TO public
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = booking_id
              AND b.%I = public.current_profile_id()
          )
      )
  $sql$, v_renter_col);

  CREATE POLICY payments_update_scope
    ON public.payments
    FOR UPDATE
    TO public
    USING (auth.role() = 'service_role' OR public.is_admin())
    WITH CHECK (auth.role() = 'service_role' OR public.is_admin());
END $$;

-- =============================================================================
-- H) RLS — disputes + guest_reviews
-- =============================================================================

DO $$
DECLARE
  v_renter_col text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'disputes') THEN
    RETURN;
  END IF;

  SELECT c.column_name INTO v_renter_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'bookings'
    AND c.column_name IN ('renter_id', 'user_id', 'guest_id')
  ORDER BY
    CASE c.column_name
      WHEN 'renter_id' THEN 1
      WHEN 'user_id' THEN 2
      WHEN 'guest_id' THEN 3
    END
  LIMIT 1;

  IF v_renter_col IS NULL THEN
    RAISE EXCEPTION
      'Stage 047 (disputes): public.bookings has no party column (renter_id / user_id / guest_id)';
  END IF;

  ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS disputes_select_scope ON public.disputes;
  EXECUTE format($sql$
    CREATE POLICY disputes_select_scope
      ON public.disputes
      FOR SELECT
      TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR opened_by = public.current_profile_id()
        OR against_user_id = public.current_profile_id()
        OR EXISTS (
            SELECT 1
            FROM public.bookings b
            WHERE b.id = booking_id
              AND (
                b.%I = public.current_profile_id()
                OR EXISTS (
                  SELECT 1 FROM public.listings l
                  WHERE l.id = b.listing_id AND l.owner_id = public.current_profile_id()
                )
              )
          )
      )
  $sql$, v_renter_col);

  DROP POLICY IF EXISTS disputes_insert_party ON public.disputes;
  CREATE POLICY disputes_insert_party
    ON public.disputes
    FOR INSERT
    TO public
    WITH CHECK (
      auth.role() = 'service_role'
      OR public.is_admin()
      OR opened_by = public.current_profile_id()
    );
  DROP POLICY IF EXISTS disputes_update_scope ON public.disputes;
  CREATE POLICY disputes_update_scope
    ON public.disputes
    FOR UPDATE
    TO public
    USING (
      auth.role() = 'service_role'
      OR public.is_admin()
      OR opened_by = public.current_profile_id()
    )
    WITH CHECK (
      auth.role() = 'service_role'
      OR public.is_admin()
      OR opened_by = public.current_profile_id()
    );
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'guest_reviews') THEN
    ALTER TABLE public.guest_reviews ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS guest_reviews_select_scope ON public.guest_reviews;
    CREATE POLICY guest_reviews_select_scope
      ON public.guest_reviews
      FOR SELECT
      TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR author_id = public.current_profile_id()
        OR guest_id = public.current_profile_id()
      );
    DROP POLICY IF EXISTS guest_reviews_write_author ON public.guest_reviews;
    CREATE POLICY guest_reviews_write_author
      ON public.guest_reviews
      FOR INSERT
      TO public
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR author_id = public.current_profile_id()
      );
    DROP POLICY IF EXISTS guest_reviews_update_author ON public.guest_reviews;
    CREATE POLICY guest_reviews_update_author
      ON public.guest_reviews
      FOR UPDATE
      TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR author_id = public.current_profile_id()
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR author_id = public.current_profile_id()
      );
  END IF;
END $$;

-- reviews (guest → listing): reviewer column prefers user_id, else renter_id (align with app API)
DO $$
DECLARE
  v_rev_col text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reviews') THEN
    RETURN;
  END IF;

  SELECT c.column_name INTO v_rev_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'reviews'
    AND c.column_name IN ('user_id', 'renter_id')
  ORDER BY
    CASE c.column_name
      WHEN 'user_id' THEN 1
      WHEN 'renter_id' THEN 2
    END
  LIMIT 1;

  IF v_rev_col IS NULL THEN
    RAISE EXCEPTION
      'Stage 047: public.reviews has no reviewer column (need one of: user_id, renter_id)';
  END IF;

  ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "reviews_select_all" ON public.reviews;
  DROP POLICY IF EXISTS reviews_select_scope ON public.reviews;
  DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
  DROP POLICY IF EXISTS reviews_insert_renter ON public.reviews;
  DROP POLICY IF EXISTS "reviews_update_reply" ON public.reviews;
  DROP POLICY IF EXISTS reviews_update_owner_reply ON public.reviews;

  EXECUTE format($sql$
    CREATE POLICY reviews_select_scope
      ON public.reviews
      FOR SELECT
      TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
        OR EXISTS (
            SELECT 1
            FROM public.listings l
            WHERE l.id = listing_id
              AND l.owner_id = public.current_profile_id()
          )
        OR EXISTS (
            SELECT 1
            FROM public.listings l
            WHERE l.id = listing_id
              AND l.status = 'ACTIVE'::public.listing_status
          )
      )
  $sql$, v_rev_col);

  EXECUTE format($sql$
    CREATE POLICY reviews_insert_renter
      ON public.reviews
      FOR INSERT
      TO public
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
      )
  $sql$, v_rev_col);

  EXECUTE format($sql$
    CREATE POLICY reviews_update_owner_reply
      ON public.reviews
      FOR UPDATE
      TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
        OR EXISTS (
            SELECT 1
            FROM public.listings l
            WHERE l.id = listing_id
              AND l.owner_id = public.current_profile_id()
          )
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
        OR EXISTS (
            SELECT 1
            FROM public.listings l
            WHERE l.id = listing_id
              AND l.owner_id = public.current_profile_id()
          )
      )
  $sql$, v_rev_col, v_rev_col);
END $$;
