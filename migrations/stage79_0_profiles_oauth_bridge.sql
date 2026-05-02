-- Stage 79.0 — Supabase Auth (Google/Apple) bridge to public.profiles (SSOT app identity stays profiles.id TEXT).
-- Run in Supabase SQL editor or via your migration runner.

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS auth_user_id TEXT;

COMMENT ON COLUMN public.profiles.auth_user_id IS
  'Supabase Auth auth.users.id (uuid as text) linked for OAuth identity; UNIQUE when set';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_auth_user_id_unique
  ON public.profiles (auth_user_id)
  WHERE auth_user_id IS NOT NULL AND btrim(auth_user_id) <> '';

-- OAuth-only profiles have no bcrypt password (email/password login skips empty hash anyway).
ALTER TABLE IF EXISTS public.profiles
  ALTER COLUMN password_hash DROP NOT NULL;
