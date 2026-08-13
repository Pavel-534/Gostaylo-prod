-- Stage 201.09 — purge TEST ledger rows without weakening append-only for live money.
-- Real capture journals stay protected: cron calls scope=markers only.
-- scope=all requires SET LOCAL airento.purge_test_ledger = 'on' (pre-launch / explicit ops).
-- Stage 201.09b replaces ledger_journal_is_test (no unpaid/cancelled status heuristic).

CREATE OR REPLACE FUNCTION public.ledger_journal_is_test(j public.ledger_journals)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    j.booking_id IS NULL
    OR j.id ILIKE '%smoke%'
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
          OR b.status IN ('CANCELLED', 'INQUIRY', 'PENDING', 'AWAITING_PAYMENT')
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
  'Stage 201.09 — test/orphan journal detector for purge_test_ledger_rows(markers).';

CREATE OR REPLACE FUNCTION public.purge_test_ledger_rows(p_scope text DEFAULT 'markers')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_entries int := 0;
  n_journals int := 0;
  n_accounts int := 0;
BEGIN
  IF p_scope NOT IN ('markers', 'all') THEN
    RAISE EXCEPTION 'purge_test_ledger_rows: scope must be markers|all';
  END IF;
  IF p_scope = 'all'
    AND current_setting('airento.purge_test_ledger', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'purge_test_ledger_rows(all) requires SET LOCAL airento.purge_test_ledger = on';
  END IF;

  ALTER TABLE public.ledger_entries DISABLE TRIGGER trg_ledger_entries_append_only;
  ALTER TABLE public.ledger_journals DISABLE TRIGGER trg_ledger_journals_append_only;

  BEGIN
    IF p_scope = 'all' THEN
      DELETE FROM public.ledger_entries;
      GET DIAGNOSTICS n_entries = ROW_COUNT;
      DELETE FROM public.ledger_journals;
      GET DIAGNOSTICS n_journals = ROW_COUNT;
    ELSE
      DELETE FROM public.ledger_entries e
      WHERE e.journal_id IN (
        SELECT j.id FROM public.ledger_journals j WHERE public.ledger_journal_is_test(j)
      );
      GET DIAGNOSTICS n_entries = ROW_COUNT;
      DELETE FROM public.ledger_journals j
      WHERE public.ledger_journal_is_test(j);
      GET DIAGNOSTICS n_journals = ROW_COUNT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.ledger_entries ENABLE TRIGGER trg_ledger_entries_append_only;
    ALTER TABLE public.ledger_journals ENABLE TRIGGER trg_ledger_journals_append_only;
    RAISE;
  END;

  ALTER TABLE public.ledger_entries ENABLE TRIGGER trg_ledger_entries_append_only;
  ALTER TABLE public.ledger_journals ENABLE TRIGGER trg_ledger_journals_append_only;

  DELETE FROM public.ledger_accounts a
  WHERE a.partner_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.ledger_entries e WHERE e.account_id = a.id
    );
  GET DIAGNOSTICS n_accounts = ROW_COUNT;

  RETURN jsonb_build_object(
    'scope', p_scope,
    'entries', n_entries,
    'journals', n_journals,
    'partner_accounts', n_accounts
  );
END;
$$;

COMMENT ON FUNCTION public.purge_test_ledger_rows(text) IS
  'Stage 201.09 — delete TEST ledger rows (markers) or all rows (ops GUC). Live append-only triggers stay on after return.';

REVOKE ALL ON FUNCTION public.ledger_journal_is_test(public.ledger_journals) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_test_ledger_rows(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ledger_journal_is_test(public.ledger_journals) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_test_ledger_rows(text) TO service_role;
