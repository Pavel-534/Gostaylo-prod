-- Stage 202.27b — earliest COMPLETED booking per partner for qualified-host metrics (engagement).
-- Replaces row fetch in loadQualifiedHostSets; preserves MIN(updated_at, created_at) semantics.

CREATE OR REPLACE FUNCTION public.qualified_host_first_completed_booking(p_referee_ids text[])
RETURNS TABLE (referee_id text, first_completed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    b.partner_id::text AS referee_id,
    MIN(COALESCE(b.updated_at, b.created_at)) AS first_completed_at
  FROM public.bookings b
  WHERE b.status = 'COMPLETED'
    AND b.partner_id = ANY (COALESCE(p_referee_ids, ARRAY[]::text[]))
  GROUP BY b.partner_id;
$$;

COMMENT ON FUNCTION public.qualified_host_first_completed_booking(text[]) IS
  'Stage 202.27b — MIN completion time per partner_id for qualified host ladder (not row count).';

GRANT EXECUTE ON FUNCTION public.qualified_host_first_completed_booking(text[]) TO service_role;
