-- Семантический поиск (pgvector). Без этого шага тип vector не существует → ERROR 42704.
-- В Supabase: Database → Extensions → включить «vector», либо выполнить строку ниже в SQL Editor.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE listings ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

COMMENT ON COLUMN listings.embedding IS 'Listing text/image embedding for semantic search; optional';
