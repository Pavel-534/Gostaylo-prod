-- Stage 203.02 — AUDIT_LEDGER_01 C-L3
-- Preserve ledger history when a booking row is deleted:
--   booking_id FK: ON DELETE CASCADE → ON DELETE SET NULL
--   stamp deleted_booking_id before nulling for audit trail.
-- ledger_entries.journal_id stays ON DELETE CASCADE (entries without journal are garbage).

ALTER TABLE public.ledger_journals
  ADD COLUMN IF NOT EXISTS deleted_booking_id TEXT NULL;

COMMENT ON COLUMN public.ledger_journals.deleted_booking_id IS
  'AUDIT_LEDGER_01: original booking_id preserved when booking row is deleted (FK SET NULL).';

COMMENT ON COLUMN public.ledger_journals.booking_id IS
  'Booking for payment-capture journals; NULL for payout/ops journals or after booking delete (see deleted_booking_id).';

-- Stamp audit id and clear booking_id before row delete (FK SET NULL is backup).
-- Append-only (203.03) allows only these column changes on ledger_journals.
CREATE OR REPLACE FUNCTION public.ledger_stamp_deleted_booking_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ledger_journals
  SET
    deleted_booking_id = COALESCE(deleted_booking_id, OLD.id),
    booking_id = NULL
  WHERE booking_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_stamp_deleted_booking ON public.bookings;
CREATE TRIGGER trg_ledger_stamp_deleted_booking
  BEFORE DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.ledger_stamp_deleted_booking_id();

-- Recreate FK without CASCADE
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class rel ON rel.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE n.nspname = 'public'
    AND rel.relname = 'ledger_journals'
    AND c.contype = 'f'
    AND pg_get_constraintdef(c.oid) ILIKE '%booking_id%bookings%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.ledger_journals DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.ledger_journals
    ADD CONSTRAINT ledger_journals_booking_id_fkey
    FOREIGN KEY (booking_id)
    REFERENCES public.bookings (id)
    ON DELETE SET NULL;
END;
$$;
