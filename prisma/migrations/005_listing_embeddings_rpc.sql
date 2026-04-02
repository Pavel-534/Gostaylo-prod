-- RPC для записи vector(1536) из приложения (PostgREST не всегда сериализует vector из JSON).
-- Поиск: косинусное расстояние pgvector (<=>).

CREATE OR REPLACE FUNCTION public.set_listing_embedding(p_listing_id text, p_embedding text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE listings
  SET embedding = p_embedding::vector(1536)
  WHERE id = p_listing_id;
$$;

COMMENT ON FUNCTION public.set_listing_embedding(text, text) IS 'Запись эмбеддинга объявления (JSON-массив чисел как текст)';

-- Семантический поиск: query_embedding — строка вида "[0.1,0.2,...]" длины 1536
CREATE OR REPLACE FUNCTION public.match_listings(
  query_embedding text,
  match_count int DEFAULT 10,
  filter_status text DEFAULT 'ACTIVE'
)
RETURNS TABLE (
  id text,
  owner_id text,
  title text,
  district text,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    l.id,
    l.owner_id,
    l.title,
    COALESCE(l.district, '')::text,
    (1 - (l.embedding <=> query_embedding::vector(1536)))::double precision AS similarity
  FROM listings l
  WHERE l.embedding IS NOT NULL
    AND l.status::text = filter_status
  ORDER BY l.embedding <=> query_embedding::vector(1536)
  LIMIT GREATEST(1, LEAST(match_count, 100));
$$;

COMMENT ON FUNCTION public.match_listings(text, int, text) IS 'Косинусное сходство (1 - distance) по listings.embedding';

GRANT EXECUTE ON FUNCTION public.set_listing_embedding(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_listings(text, int, text) TO service_role;
