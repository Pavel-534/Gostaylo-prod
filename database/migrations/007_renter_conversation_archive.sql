-- Рентёр может скрыть диалог из списка в кабинете (история и доступ поддержки сохраняются).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS renter_archived_at TIMESTAMPTZ;

COMMENT ON COLUMN conversations.renter_archived_at IS 'Рентёр скрыл диалог в личном кабинете';

CREATE INDEX IF NOT EXISTS idx_conversations_renter_archived
  ON conversations (renter_id)
  WHERE renter_archived_at IS NOT NULL;
