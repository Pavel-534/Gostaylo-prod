-- 019: Составной индекс для истории чата; B-tree по координатам для карты.
-- Применять в Supabase SQL Editor или через свой пайплайн миграций.
-- Без CONCURRENTLY — совместимость с транзакционными раннерами.

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at_desc
  ON public.messages (conversation_id, created_at DESC);

-- Карта: точки с заданными lat/lng (частичный индекс уменьшает размер)
CREATE INDEX IF NOT EXISTS idx_listings_latitude_longitude_map
  ON public.listings (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON INDEX idx_messages_conversation_id_created_at_desc IS
  'Лента сообщений по треду: фильтр по conversation_id + сортировка по времени.';
COMMENT ON INDEX idx_listings_latitude_longitude_map IS
  'Ускорение выборок объектов на карте по паре координат (B-tree).';
