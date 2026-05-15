-- Stage 95.4 — RLS recursion fix (post 047 / 048 / 049).
-- Problem: policies on profiles/listings/bookings call public.is_admin() and public.current_profile_id();
--          those functions SELECT from profiles → RLS re-evaluates → infinite recursion (42P17).
-- Fix: JWT role fast-path; early exit when no profile id; SET LOCAL row_security = off before any profiles read.
-- Also: lock down public.system_settings (anon was able to SELECT rows).
--
-- Idempotent: CREATE OR REPLACE functions; DROP POLICY IF EXISTS; policy sweep via pg_policies.
-- Prerequisites: 047 (core RLS), 048 (is_admin), optional 049 (storage).

-- =============================================================================
-- A) current_profile_id — bypass RLS for auth_user_id / legacy id lookups only
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

  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SET LOCAL row_security = off;

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

  SELECT p.id INTO pid FROM public.profiles p WHERE p.id = v_auth LIMIT 1;
  RETURN pid;
END;
$$;

COMMENT ON FUNCTION public.current_profile_id() IS
  'Stage 95.4: profile id from JWT (profile_id/userId) or profiles.auth_user_id; profiles lookup uses SET LOCAL row_security = off to avoid RLS recursion.';

-- =============================================================================
-- B) is_admin — JWT ADMIN fast-path; DB fallback only with row_security off
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  app_role text;
  pid text;
BEGIN
  BEGIN
    claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    claims := NULL;
  END;

  IF claims IS NOT NULL THEN
    app_role := upper(btrim(coalesce(
      claims->>'role',
      claims->>'app_role',
      claims #>> '{user_metadata,role}',
      claims #>> '{app_metadata,role}',
      ''
    )));
    IF app_role = 'ADMIN' THEN
      RETURN TRUE;
    END IF;
  END IF;

  pid := public.current_profile_id();
  IF pid IS NULL THEN
    RETURN FALSE;
  END IF;

  SET LOCAL row_security = off;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = pid
      AND p.role = 'ADMIN'
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Stage 95.4: true for JWT role ADMIN (role/app_role/metadata) or profiles.role=ADMIN; no RLS recursion on profiles.';

-- =============================================================================
-- C) system_settings — staff-only (service_role API + ADMIN via is_admin)
-- =============================================================================

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.system_settings', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY system_settings_select_staff
  ON public.system_settings
  FOR SELECT
  TO public
  USING (
    auth.role() = 'service_role'
    OR public.is_admin()
  );

CREATE POLICY system_settings_insert_staff
  ON public.system_settings
  FOR INSERT
  TO public
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin()
  );

CREATE POLICY system_settings_update_staff
  ON public.system_settings
  FOR UPDATE
  TO public
  USING (
    auth.role() = 'service_role'
    OR public.is_admin()
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin()
  );

CREATE POLICY system_settings_delete_staff
  ON public.system_settings
  FOR DELETE
  TO public
  USING (
    auth.role() = 'service_role'
    OR public.is_admin()
  );

COMMENT ON TABLE public.system_settings IS
  'Stage 95.4: RLS — service_role (API) and ADMIN only; MODERATOR/anon/authenticated have no direct PostgREST access.';
