-- Stage 15.0: public bucket for dispute photo evidence (upload via POST /api/v2/upload, bucket=dispute-evidence).
-- Run in Supabase SQL Editor if the bucket does not exist yet. Adjust RLS policies to match your project (see storage policies for review-images).

INSERT INTO storage.buckets (id, name, public)
VALUES ('dispute-evidence', 'dispute-evidence', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
