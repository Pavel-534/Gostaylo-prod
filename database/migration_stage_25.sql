-- FunnyRent 2.1 - Database Migration Script
-- Execute in Supabase SQL Editor (Dashboard > SQL Editor)
-- Date: 2026-02-28

-- ============================================
-- 1. ADD SYNC_SETTINGS COLUMN TO LISTINGS
-- ============================================
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sync_settings JSONB DEFAULT '{}';

COMMENT ON COLUMN listings.sync_settings IS 'iCal synchronization settings: sources array, auto_sync boolean, sync_interval_hours';

-- ============================================
-- 2. CREATE CONVERSATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  partner_id TEXT,
  partner_name TEXT,
  renter_id TEXT,
  renter_name TEXT,
  admin_id TEXT,
  admin_name TEXT,
  type TEXT DEFAULT 'INQUIRY' CHECK (type IN ('INQUIRY', 'BOOKING', 'SUPPORT', 'ADMIN_FEEDBACK')),
  status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'ARCHIVED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_partner ON conversations(partner_id);
CREATE INDEX IF NOT EXISTS idx_conversations_renter ON conversations(renter_id);
CREATE INDEX IF NOT EXISTS idx_conversations_listing ON conversations(listing_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- ============================================
-- 3. CREATE MESSAGES TABLE WITH IS_READ
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('ADMIN', 'PARTNER', 'RENTER', 'SYSTEM')),
  sender_name TEXT,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'TEXT' CHECK (type IN ('TEXT', 'SYSTEM', 'BOOKING_REQUEST', 'BOOKING_UPDATE', 'REJECTION')),
  metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- 4. ADD LISTING STATUS 'REJECTED' (if not exists)
-- ============================================
-- Note: This may fail if the enum already has this value, which is fine
DO $$ 
BEGIN
  ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'REJECTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 5. ADD REJECTION TRACKING TO LISTINGS
-- ============================================
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rejected_by TEXT;

-- ============================================
-- 6. ADD TELEGRAM_ID TO PROFILES (if not exists)
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram ON profiles(telegram_id) WHERE telegram_id IS NOT NULL;

-- ============================================
-- 7. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own conversations
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (
    auth.uid()::text = partner_id OR 
    auth.uid()::text = renter_id OR 
    auth.uid()::text = admin_id
  );

-- Allow authenticated users to insert conversations
CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to read messages in their conversations
CREATE POLICY "Users can view messages in own conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = conversation_id 
      AND (c.partner_id = auth.uid()::text OR c.renter_id = auth.uid()::text OR c.admin_id = auth.uid()::text)
    )
  );

-- Allow users to send messages
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 8. SERVICE ROLE BYPASS (for API calls)
-- ============================================
-- Service role can do anything
CREATE POLICY "Service role full access conversations" ON conversations
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access messages" ON messages
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the migration:

-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'sync_settings';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_read';
-- SELECT * FROM pg_tables WHERE tablename IN ('conversations', 'messages');
