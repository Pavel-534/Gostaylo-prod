-- Stage 189.1 — Account linking: verified-email auto-merge + identity registry + conflict queue.
-- SSOT product sync remains in lib/services/auth/oauth-profile-sync.service.js +
-- lib/auth/account-linking.service.js; this migration hardens the auth.users trigger
-- and persists linked providers on public.profiles.

-- =============================================================================
-- A) profile_auth_identities — which sign-in methods are linked to a profile
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profile_auth_identities (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT,
  auth_user_id TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT profile_auth_identities_provider_check
    CHECK (provider = ANY (ARRAY[
      'email'::text,
      'phone'::text,
      'telegram'::text,
      'google'::text,
      'apple'::text,
      'yandex'::text,
      'vk'::text
    ]))
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_auth_identities_profile_provider_uidx
  ON public.profile_auth_identities (profile_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS profile_auth_identities_provider_subject_uidx
  ON public.profile_auth_identities (provider, provider_subject)
  WHERE provider_subject IS NOT NULL AND btrim(provider_subject) <> '';

CREATE INDEX IF NOT EXISTS profile_auth_identities_auth_user_idx
  ON public.profile_auth_identities (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON TABLE public.profile_auth_identities IS
  'Stage 189.1: linked auth methods per profiles row (email/phone/Telegram/OAuth).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_auth_identities TO service_role;

ALTER TABLE public.profile_auth_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stage189_1_profile_auth_identities_own_select ON public.profile_auth_identities;
CREATE POLICY stage189_1_profile_auth_identities_own_select
  ON public.profile_auth_identities
  FOR SELECT TO authenticated
  USING (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR profile_id::text = public.current_profile_id()
  );

GRANT SELECT ON public.profile_auth_identities TO authenticated;

-- =============================================================================
-- B) auth_link_conflicts — pending cross-profile identity conflicts (UX queue)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.auth_link_conflicts (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  challenger_profile_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  occupied_profile_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  auth_user_id TEXT,
  provider_email TEXT,
  provider_subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'resolved_login'::text, 'resolved_merge'::text, 'expired'::text, 'cancelled'::text])),
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS auth_link_conflicts_token_idx
  ON public.auth_link_conflicts (token)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS auth_link_conflicts_expires_idx
  ON public.auth_link_conflicts (expires_at);

COMMENT ON TABLE public.auth_link_conflicts IS
  'Stage 189.1: OAuth/Telegram identity already bound to another profile — /auth/link-conflict.';

GRANT ALL ON public.auth_link_conflicts TO service_role;

ALTER TABLE public.auth_link_conflicts ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies — API uses service_role only.

-- =============================================================================
-- C) handle_new_user — auto-link by email ONLY when provider email is verified
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
  v_email_verified boolean := false;
  v_provider text;
BEGIN
  v_auth := NEW.id::text;
  v_email := NULLIF(lower(trim(COALESCE(NEW.email, ''))), '');
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_provider := NULLIF(lower(trim(COALESCE(
    v_meta->>'provider',
    v_meta->>'iss',
    NEW.raw_app_meta_data->>'provider',
    ''
  ))), '');

  -- Verified email gate (Stage 189.1): never auto-merge unverified emails.
  v_email_verified :=
    NEW.email_confirmed_at IS NOT NULL
    OR COALESCE((v_meta->>'email_verified')::boolean, false) = true
    OR lower(COALESCE(v_meta->>'email_verified', '')) IN ('true', '1', 'yes');

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id IS NOT NULL AND btrim(p.auth_user_id) <> '' AND p.auth_user_id = v_auth
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(trim(p.email)) = v_email AND COALESCE(p.is_banned, false) = true
  ) THEN
    RETURN NEW;
  END IF;

  -- Auto-attach auth_user_id to existing profile ONLY with verified email.
  IF v_email_verified THEN
    UPDATE public.profiles p
    SET
      auth_user_id = v_auth,
      is_verified = true,
      updated_at = now()
    WHERE lower(trim(p.email)) = v_email
      AND (p.auth_user_id IS NULL OR btrim(p.auth_user_id) = '')
      AND COALESCE(p.is_banned, false) = false;

    IF FOUND THEN
      INSERT INTO public.profile_auth_identities (id, profile_id, provider, provider_subject, auth_user_id, metadata)
      SELECT
        'pai-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
        p.id,
        COALESCE(NULLIF(v_provider, ''), 'email'),
        v_auth,
        v_auth,
        jsonb_build_object('source', 'handle_new_user_link', 'email', v_email)
      FROM public.profiles p
      WHERE p.auth_user_id = v_auth
      ON CONFLICT (profile_id, provider) DO UPDATE
        SET auth_user_id = EXCLUDED.auth_user_id,
            provider_subject = COALESCE(EXCLUDED.provider_subject, public.profile_auth_identities.provider_subject),
            linked_at = now();
      RETURN NEW;
    END IF;
  END IF;

  -- Existing profile already has a different auth_user_id → do not create a duplicate row.
  -- Product layer opens /auth/link-conflict; trigger must not invent a second profile.
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(trim(p.email)) = v_email
      AND p.auth_user_id IS NOT NULL
      AND btrim(p.auth_user_id) <> ''
      AND p.auth_user_id <> v_auth
  ) THEN
    RETURN NEW;
  END IF;

  -- Unverified email + no empty-slot profile → skip insert (avoid unverified takeovers).
  -- OAuth product sync still creates/links via service_role after email_verified check.
  IF NOT v_email_verified THEN
    RETURN NEW;
  END IF;

  v_pid := 'user-' || to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MSUS') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);

  v_ref := 'AIR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  WHILE EXISTS (SELECT 1 FROM public.profiles x WHERE x.referral_code = v_ref) LOOP
    v_ref := 'AIR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  END LOOP;

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
    true,
    'VERIFIED'::public.verification_status,
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

  INSERT INTO public.profile_auth_identities (id, profile_id, provider, provider_subject, auth_user_id, metadata)
  VALUES (
    'pai-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    v_pid,
    COALESCE(NULLIF(v_provider, ''), 'email'),
    v_auth,
    v_auth,
    jsonb_build_object('source', 'handle_new_user_insert', 'email', v_email)
  )
  ON CONFLICT (profile_id, provider) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Stage 189.1: AFTER INSERT on auth.users — link existing profile by verified email only; skip unverified email takeover; record profile_auth_identities.';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
  END IF;
END
$grant$;
