-- AI usage audit + quota support
--
-- В проекте fannyrent-db (и ряде других) profiles.id и listings.id — TEXT, не UUID.
-- Оба FK ниже TEXT; иначе PostgreSQL вернёт 42804 (несовместимость uuid/text).

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  task_type VARCHAR(80) NOT NULL,
  model VARCHAR(80) NOT NULL,
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  cost_usd NUMERIC(14, 6),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_month ON ai_usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_listing_task ON ai_usage_logs (listing_id, task_type)
  WHERE listing_id IS NOT NULL;

COMMENT ON TABLE ai_usage_logs IS 'OpenAI calls: tokens, estimated USD, for quotas and partner cost widget';
