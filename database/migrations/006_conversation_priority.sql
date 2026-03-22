-- Флаг эскалации в поддержку: приоритетный показ в админском inbox
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN conversations.is_priority IS 'Пользователь запросил помощь; диалог поднимается вверх в списке админа';

CREATE INDEX IF NOT EXISTS idx_conversations_priority_last_msg
  ON conversations (is_priority DESC, last_message_at DESC NULLS LAST);
