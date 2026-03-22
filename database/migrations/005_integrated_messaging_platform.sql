-- =============================================================================
-- 005: Integrated Messaging Platform (conversations, messages, invoices)
-- Run in Supabase SQL Editor. Idempotent (IF NOT EXISTS / safe updates).
--
-- AUDIT (кратко):
-- ОСТАВИТЬ: hooks/use-realtime-chat.js (Supabase Realtime — ок для РФ через ваш домен),
--   UI страницы partner/renter/admin messages, components/chat-*.jsx,
--   логику Telegram в notification.service (отдельный канал).
-- ПЕРЕПИСАТЬ/РАСШИРИТЬ: app/api/v2/messages/route.js → единая точка POST/GET через
--   /api/v2/chat/* с сессией, типами сообщений и счётами; chat/invoice/route —
--   постепенно свести к таблице invoices + POST messages type=invoice.
-- СХЕМА: добавляем booking_id, listing_category, status_label, last_message_at;
--   messages.content (зеркало legacy message); type в нижнем регистре;
--   отдельная invoices.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- conversations: поля под фильтры и «умный» inbox
-- ---------------------------------------------------------------------------
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS booking_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS listing_category TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status_label TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

UPDATE conversations
SET status_label = COALESCE(status_label, status, 'open')
WHERE status_label IS NULL;

UPDATE conversations
SET last_message_at = COALESCE(last_message_at, updated_at, created_at)
WHERE last_message_at IS NULL;

-- Денормализация категории листинга (для фильтра без join на каждый запрос)
UPDATE conversations c
SET listing_category = l.category_id
FROM listings l
WHERE c.listing_id = l.id
  AND c.listing_category IS NULL
  AND l.category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_listing_category ON conversations(listing_category);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversations_booking_id ON conversations(booking_id);

-- ---------------------------------------------------------------------------
-- messages: content (спецификация CA) + совместимость с полем message
-- ---------------------------------------------------------------------------
ALTER TABLE messages ADD COLUMN IF NOT EXISTS content TEXT;

UPDATE messages SET content = COALESCE(content, message) WHERE content IS NULL OR content = '';

-- Нормализация только безопасных legacy-типов (не трогаем BOOKING_REQUEST и т.п.)
UPDATE messages SET type = 'invoice' WHERE upper(trim(type)) = 'INVOICE';
UPDATE messages SET type = 'text' WHERE upper(trim(type)) = 'TEXT' OR type IS NULL OR trim(type) = '';
UPDATE messages SET type = 'image' WHERE upper(trim(type)) = 'IMAGE';

ALTER TABLE messages ALTER COLUMN type SET DEFAULT 'text';

-- ---------------------------------------------------------------------------
-- invoices: отдельная сущность (не только JSON в metadata)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  booking_id TEXT,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_conversation ON invoices(conversation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Участники диалога видят счета в своих беседах (как у messages)
DROP POLICY IF EXISTS "invoices_select_conversation_participants" ON invoices;
CREATE POLICY "invoices_select_conversation_participants" ON invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = invoices.conversation_id
        AND (
          c.owner_id = (SELECT auth.uid()::text)
          OR c.partner_id = (SELECT auth.uid()::text)
          OR c.renter_id = (SELECT auth.uid()::text)
          OR c.admin_id = (SELECT auth.uid()::text)
        )
    )
  );

DROP POLICY IF EXISTS "invoices_insert_participants" ON invoices;
CREATE POLICY "invoices_insert_participants" ON invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = invoices.conversation_id
        AND (
          c.owner_id = (SELECT auth.uid()::text)
          OR c.partner_id = (SELECT auth.uid()::text)
        )
    )
  );

DROP POLICY IF EXISTS "invoices_update_participants" ON invoices;
CREATE POLICY "invoices_update_participants" ON invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = invoices.conversation_id
        AND (
          c.owner_id = (SELECT auth.uid()::text)
          OR c.partner_id = (SELECT auth.uid()::text)
          OR c.renter_id = (SELECT auth.uid()::text)
        )
    )
  );

GRANT ALL ON invoices TO authenticated;
GRANT ALL ON invoices TO service_role;

-- ---------------------------------------------------------------------------
-- Триггер: обновлять last_message_at у conversation при новом сообщении
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_messages_bump_conversation_last ON messages;
CREATE TRIGGER tr_messages_bump_conversation_last
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_conversation_last_message();

COMMENT ON TABLE invoices IS 'Chat-linked invoices; status pending|paid';
COMMENT ON COLUMN conversations.listing_category IS 'Denormalized listings.category_id for inbox filters';
COMMENT ON COLUMN messages.content IS 'Primary body; legacy message kept in sync by app';
