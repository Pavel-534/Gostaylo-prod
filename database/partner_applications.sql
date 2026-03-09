-- Partner Applications Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  social_link TEXT,
  experience TEXT NOT NULL,
  portfolio TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason TEXT,
  reviewed_by TEXT REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_user ON partner_applications(user_id);

-- RLS Policies
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

-- Users can read their own applications
CREATE POLICY "Users can view own applications" ON partner_applications
  FOR SELECT USING (user_id = current_user OR current_user IN (
    SELECT id FROM profiles WHERE role = 'ADMIN'
  ));

-- Users can insert their own applications
CREATE POLICY "Users can create applications" ON partner_applications
  FOR INSERT WITH CHECK (user_id = current_user);

-- Only admins can update applications
CREATE POLICY "Admins can update applications" ON partner_applications
  FOR UPDATE USING (current_user IN (
    SELECT id FROM profiles WHERE role = 'ADMIN'
  ));
