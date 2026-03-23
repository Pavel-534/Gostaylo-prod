-- Allow partners to cancel unpaid chat invoices
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('pending', 'paid', 'cancelled'));

COMMENT ON TABLE invoices IS 'Chat-linked invoices; status pending|paid|cancelled';
