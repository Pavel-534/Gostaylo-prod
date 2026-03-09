-- Add verification document column to partner_applications
-- Run this in Supabase SQL Editor

ALTER TABLE partner_applications 
ADD COLUMN IF NOT EXISTS verification_doc_url TEXT;

-- Add comment
COMMENT ON COLUMN partner_applications.verification_doc_url IS 'URL to uploaded ID/Passport document in verification_documents bucket';
