-- Связь message_id уведомления в Telegram → беседа на сайте (ответ reply в боте).
CREATE TABLE IF NOT EXISTS telegram_chat_reply_map (
  id BIGSERIAL PRIMARY KEY,
  telegram_chat_id TEXT NOT NULL,
  telegram_message_id INTEGER NOT NULL,
  conversation_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (telegram_chat_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_chat_reply_map_chat
  ON telegram_chat_reply_map (telegram_chat_id);

COMMENT ON TABLE telegram_chat_reply_map IS 'Позволяет webhook обработать reply на уведомление о новом сообщении в чате.';
