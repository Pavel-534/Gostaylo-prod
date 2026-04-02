-- Семантический поиск (pgvector). Колонка зарезервирована под будущие embeddings.
-- Требуется расширение vector в схеме (обычно extensions.vector).

ALTER TABLE listings ADD COLUMN IF NOT EXISTS embedding vector(1536);

COMMENT ON COLUMN listings.embedding IS 'Listing text/image embedding for semantic search; optional';
