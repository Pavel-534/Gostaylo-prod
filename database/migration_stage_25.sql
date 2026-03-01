-- FunnyRent 2.1 - Database Migration Script (FIXED)
-- Execute in Supabase SQL Editor (Dashboard > SQL Editor)
-- Date: 2026-02-28 (v2 - Fixed RLS policies)

-- ============================================
-- STEP 1: DROP EXISTING POLICIES (if any)
-- ============================================
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Service role full access conversations" ON conversations;
DROP POLICY IF EXISTS "Service role full access messages" ON messages;

-- ============================================
-- STEP 2: ADD COLUMNS TO LISTINGS TABLE
-- ============================================
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sync_settings JSONB DEFAULT '{}';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rejected_by TEXT;

-- ============================================
-- STEP 3: ADD COLUMNS TO PROFILES TABLE
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

-- ============================================
-- STEP 4: CREATE CONVERSATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  listing_id TEXT,
  owner_id TEXT,
  partner_id TEXT,
  partner_name TEXT,
  renter_id TEXT,
  renter_name TEXT,
  admin_id TEXT,
  admin_name TEXT,
  type TEXT DEFAULT 'INQUIRY',
  status TEXT DEFAULT 'OPEN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if table already exists but missing columns
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS partner_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS renter_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS renter_name TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS admin_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS admin_name TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS listing_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Set defaults for existing rows
UPDATE conversations SET type = 'INQUIRY' WHERE type IS NULL;
UPDATE conversations SET status = 'OPEN' WHERE status IS NULL;
UPDATE conversations SET created_at = NOW() WHERE created_at IS NULL;
UPDATE conversations SET updated_at = NOW() WHERE updated_at IS NULL;

-- ============================================
-- STEP 5: CREATE MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  sender_id TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  sender_name TEXT,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'TEXT',
  metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if table already exists but missing columns
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- Set defaults for existing rows
UPDATE messages SET is_read = FALSE WHERE is_read IS NULL;
UPDATE messages SET type = 'TEXT' WHERE type IS NULL;

-- ============================================
-- STEP 6: CREATE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_conversations_partner ON conversations(partner_id);
CREATE INDEX IF NOT EXISTS idx_conversations_renter ON conversations(renter_id);
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner_id);
CREATE INDEX IF NOT EXISTS idx_conversations_listing ON conversations(listing_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_telegram ON profiles(telegram_id);

-- ============================================
-- STEP 7: ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 8: CREATE RLS POLICIES
-- ============================================

-- Policy: Users can view their own conversations
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (
    auth.uid()::text = owner_id OR
    auth.uid()::text = partner_id OR 
    auth.uid()::text = renter_id OR 
    auth.uid()::text = admin_id OR
    auth.role() = 'service_role'
  );

-- Policy: Users can create conversations
CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL OR 
    auth.role() = 'service_role'
  );

-- Policy: Users can update their own conversations  
CREATE POLICY "Users can update own conversations" ON conversations
  FOR UPDATE USING (
    auth.uid()::text = owner_id OR
    auth.uid()::text = partner_id OR 
    auth.uid()::text = renter_id OR 
    auth.uid()::text = admin_id OR
    auth.role() = 'service_role'
  );

-- Policy: Users can view messages in their conversations
CREATE POLICY "Users can view messages in own conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND (
        c.owner_id = auth.uid()::text OR
        c.partner_id = auth.uid()::text OR 
        c.renter_id = auth.uid()::text OR 
        c.admin_id = auth.uid()::text
      )
    ) OR auth.role() = 'service_role'
  );

-- Policy: Users can send messages
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL OR 
    auth.role() = 'service_role'
  );

-- Policy: Users can update messages (mark as read)
CREATE POLICY "Users can update messages" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND (
        c.owner_id = auth.uid()::text OR
        c.partner_id = auth.uid()::text OR 
        c.renter_id = auth.uid()::text OR 
        c.admin_id = auth.uid()::text
      )
    ) OR auth.role() = 'service_role'
  );

-- ============================================
-- STEP 9: GRANT PERMISSIONS
-- ============================================
GRANT ALL ON conversations TO authenticated;
GRANT ALL ON conversations TO service_role;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON messages TO service_role;

-- ============================================
-- VERIFICATION (run after migration)
-- ============================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'conversations';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages';
-- SELECT policyname FROM pg_policies WHERE tablename IN ('conversations', 'messages');
