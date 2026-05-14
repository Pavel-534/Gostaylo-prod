-- Stage 94b: ensure public.is_admin() exists for RLS policies (e.g. 047).
-- Idempotent CREATE OR REPLACE. Depends on public.current_profile_id() (022 / 047).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = public.current_profile_id()
      AND p.role = 'ADMIN'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'True when JWT maps to a profile with role ADMIN. Used by RLS policies.';
