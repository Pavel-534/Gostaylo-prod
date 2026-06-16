-- Stage 149.4 — allow 'expired' in invoices.status.
-- Bug: cron processExpiredPendingInvoices (app/api/cron/cleanup-drafts) writes status='expired',
-- but CHECK allowed only pending|paid|cancelled → UPDATE failed silently → invoices never expired,
-- invoice_hold (calendar_blocks.source=invoice_hold) never released by cron. Defeats Stage 149.2 P1.

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text, 'expired'::text]));
