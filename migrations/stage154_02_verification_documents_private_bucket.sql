-- Stage 154.1 — KYC bucket must be private; access via signed URLs (admin/partner API routes).

UPDATE storage.buckets
SET public = false
WHERE id = 'verification_documents';
