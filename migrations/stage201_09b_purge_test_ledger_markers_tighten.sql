-- Stage 201.09b — do not treat unpaid/cancelled status as “test ledger”.
-- Nightly markers: smoke/E2E journal ids + E2E_TEST_DATA + smoke profiles only.
-- Live capture (including later CANCELLED after real pay) stays append-only.

CREATE OR REPLACE FUNCTION public.ledger_journal_is_test(j public.ledger_journals)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    j.id ILIKE '%smoke%'
    OR j.id ILIKE '%stage104%'
    OR j.id ILIKE '%stage103%'
    OR j.id ILIKE '%user-smoke%'
    OR j.id ILIKE '%financial-smoke%'
    OR j.event_type = 'AUDIT_PROBE'
    OR EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = j.booking_id
        AND (
          coalesce(b.special_requests, '') ILIKE '%[E2E_TEST_DATA]%'
          OR coalesce(b.metadata::text, '') ILIKE '%E2E_TEST_DATA%'
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.profiles p ON p.id IN (b.partner_id, b.renter_id)
      WHERE b.id = j.booking_id
        AND (
          p.email ILIKE '%@smoke.invalid'
          OR p.email ILIKE '%@test.gostaylo.invalid'
          OR p.id LIKE 'user-smoke%'
          OR p.id LIKE 'user-s72-%'
        )
    );
$$;

COMMENT ON FUNCTION public.ledger_journal_is_test(public.ledger_journals) IS
  'Stage 201.09b — test journal detector (markers only; not unpaid/cancelled status).';
