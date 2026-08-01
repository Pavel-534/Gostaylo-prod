-- Stage 203.03 — AUDIT_LEDGER_01 C-L4 + GRANT/RLS check
-- Append-only ledger_journals / ledger_entries (no UPDATE/DELETE of money facts).
-- Exception: ledger_journals may only change booking_id → NULL and/or set deleted_booking_id
--   (Stage 203.02 booking detach / FK ON DELETE SET NULL).
-- Reverse postings = new journals later (ledger_reversal_journals — not in this stage).
-- RLS: deny-by-default for anon/authenticated; service_role bypasses RLS but NOT these triggers.

CREATE OR REPLACE FUNCTION public.ledger_reject_mutate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'ledger_journals' THEN
    -- Allow booking detach only (C-L3): preserve event_type / idempotency_key / metadata / amounts via entries
    IF NEW.id IS NOT DISTINCT FROM OLD.id
      AND NEW.event_type IS NOT DISTINCT FROM OLD.event_type
      AND NEW.idempotency_key IS NOT DISTINCT FROM OLD.idempotency_key
      AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
      AND NEW.metadata IS NOT DISTINCT FROM OLD.metadata
      AND (NEW.booking_id IS NOT DISTINCT FROM OLD.booking_id OR NEW.booking_id IS NULL)
      AND (
        NEW.deleted_booking_id IS NOT DISTINCT FROM OLD.deleted_booking_id
        OR (OLD.deleted_booking_id IS NULL AND NEW.deleted_booking_id IS NOT NULL)
      )
    THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION '% is append-only (AUDIT_LEDGER_01 C-L4): UPDATE/DELETE forbidden', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_journals_append_only ON public.ledger_journals;
CREATE TRIGGER trg_ledger_journals_append_only
  BEFORE UPDATE OR DELETE ON public.ledger_journals
  FOR EACH ROW
  EXECUTE FUNCTION public.ledger_reject_mutate();

DROP TRIGGER IF EXISTS trg_ledger_entries_append_only ON public.ledger_entries;
CREATE TRIGGER trg_ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.ledger_reject_mutate();

-- RLS (idempotent; Stage 121 already enabled — re-assert)
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- No policies for anon / authenticated (deny-by-default).
-- Backend-only grants: INSERT + SELECT; revoke UPDATE/DELETE (belt + trigger).
REVOKE ALL ON TABLE public.ledger_journals FROM PUBLIC;
REVOKE ALL ON TABLE public.ledger_entries FROM PUBLIC;
REVOKE ALL ON TABLE public.ledger_accounts FROM PUBLIC;

REVOKE ALL ON TABLE public.ledger_journals FROM anon, authenticated;
REVOKE ALL ON TABLE public.ledger_entries FROM anon, authenticated;
REVOKE ALL ON TABLE public.ledger_accounts FROM anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.ledger_journals TO service_role;
GRANT SELECT, INSERT ON TABLE public.ledger_entries TO service_role;
-- Partner accounts created at runtime; no row mutate after create needed for SoT
GRANT SELECT, INSERT ON TABLE public.ledger_accounts TO service_role;

REVOKE UPDATE, DELETE ON TABLE public.ledger_journals FROM service_role;
REVOKE UPDATE, DELETE ON TABLE public.ledger_entries FROM service_role;
REVOKE UPDATE, DELETE ON TABLE public.ledger_accounts FROM service_role;
-- TRUNCATE bypasses row BEFORE DELETE triggers
REVOKE TRUNCATE ON TABLE public.ledger_journals FROM service_role;
REVOKE TRUNCATE ON TABLE public.ledger_entries FROM service_role;
REVOKE TRUNCATE ON TABLE public.ledger_accounts FROM service_role;

COMMENT ON FUNCTION public.ledger_reject_mutate() IS
  'AUDIT_LEDGER_01 C-L4: append-only guard; journals may only detach booking_id / set deleted_booking_id.';
