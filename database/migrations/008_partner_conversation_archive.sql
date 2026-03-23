-- Партнёр скрывает диалог у себя в списке (симметрично renter_archived_at).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS partner_archived_at TIMESTAMPTZ;

COMMENT ON COLUMN conversations.partner_archived_at IS 'Партнёр скрыл диалог в кабинете; история и доступ админа сохраняются';

CREATE INDEX IF NOT EXISTS idx_conversations_partner_archived
  ON conversations (partner_id)
  WHERE partner_archived_at IS NOT NULL;
