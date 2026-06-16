-- Stage 152.2 — atomic iCal calendar_blocks replace (DELETE old + INSERT new in one TX).
-- Eliminates double-inventory window from INSERT-then-DELETE in JS.

CREATE OR REPLACE FUNCTION public.replace_calendar_blocks_for_source_v1(
  p_listing_id text,
  p_source text,
  p_blocks jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  ok boolean,
  inserted_count integer,
  deleted_count integer,
  error_code text
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
  v_inserted integer := 0;
BEGIN
  IF p_listing_id IS NULL OR trim(p_listing_id) = '' THEN
    RETURN QUERY SELECT false, 0, 0, 'LISTING_ID_REQUIRED';
    RETURN;
  END IF;
  IF p_source IS NULL OR trim(p_source) = '' THEN
    RETURN QUERY SELECT false, 0, 0, 'SOURCE_REQUIRED';
    RETURN;
  END IF;

  DELETE FROM public.calendar_blocks
  WHERE listing_id = p_listing_id
    AND source = p_source;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF p_blocks IS NOT NULL
     AND jsonb_typeof(p_blocks) = 'array'
     AND jsonb_array_length(p_blocks) > 0 THEN
    INSERT INTO public.calendar_blocks (
      listing_id,
      start_date,
      end_date,
      reason,
      source
    )
    SELECT
      p_listing_id,
      (elem->>'start_date')::date,
      (elem->>'end_date')::date,
      coalesce(nullif(trim(elem->>'reason'), ''), 'Blocked'),
      p_source
    FROM jsonb_array_elements(p_blocks) AS elem
    WHERE coalesce(elem->>'start_date', '') <> ''
      AND coalesce(elem->>'end_date', '') <> '';

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT true, v_inserted, v_deleted, NULL::text;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, 0, 0, SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.replace_calendar_blocks_for_source_v1(text, text, jsonb) IS
  'Stage 152.2 — atomic replace calendar_blocks for one iCal source (DELETE then INSERT, single TX).';

GRANT EXECUTE ON FUNCTION public.replace_calendar_blocks_for_source_v1(text, text, jsonb) TO service_role;
