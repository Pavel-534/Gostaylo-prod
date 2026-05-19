-- Stage 102.3 — admin legal registry + payout settlement PDF metadata

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.payouts.documents IS
  'Settlement PDFs: { act?: { path, url, generatedAt }, invoice?: { ... } } (Stage 102.3).';

-- Private bucket for partner payout / settlement PDFs (service_role upload; signed URL for download)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('payout-documents', 'payout-documents', false, 15728640)
ON CONFLICT (id) DO NOTHING;
