-- Stage 160 — location suggestion resolution (MERGED status + atomic merge RPC).

BEGIN;

ALTER TABLE public.location_suggestions
  DROP CONSTRAINT IF EXISTS location_suggestions_status_check;

ALTER TABLE public.location_suggestions
  ADD CONSTRAINT location_suggestions_status_check
  CHECK (status IN ('PENDING', 'MERGED', 'REJECTED', 'REVIEWED'));

ALTER TABLE public.location_suggestions
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merge_target_code TEXT,
  ADD COLUMN IF NOT EXISTS merge_target_type TEXT
    CHECK (
      merge_target_type IS NULL
      OR merge_target_type IN ('country', 'region', 'city', 'district')
    ),
  ADD COLUMN IF NOT EXISTS reject_reason TEXT;

COMMENT ON COLUMN public.location_suggestions.merge_target_code IS
  'Stage 160 — canonical code after admin MERGE.';

-- Count ACTIVE listings referencing a pending raw term (queue sort).
CREATE OR REPLACE FUNCTION public.count_listings_for_location_term_v1(
  p_raw_term TEXT,
  p_kind TEXT DEFAULT 'district',
  p_suggested_listing_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM public.listings l
  WHERE l.status = 'ACTIVE'
    AND (
      lower(trim(l.district)) = lower(trim(p_raw_term))
      OR lower(trim(l.metadata->'unverified_location'->>'raw_term')) = lower(trim(p_raw_term))
      OR (p_suggested_listing_id IS NOT NULL AND l.id = p_suggested_listing_id)
    );
$$;

COMMENT ON FUNCTION public.count_listings_for_location_term_v1 IS
  'Stage 160 — listings_count for admin location suggestion queue.';

-- Atomic MERGE: geo_synonyms + listings + suggestion status.
CREATE OR REPLACE FUNCTION public.resolve_location_suggestion_merge_v1(
  p_suggestion_id TEXT,
  p_target_code TEXT,
  p_target_type TEXT,
  p_resolved_by TEXT,
  p_synonym_lang TEXT DEFAULT '*'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.location_suggestions%ROWTYPE;
  v_synonym_id TEXT;
  v_merged_count INTEGER := 0;
  v_raw_lower TEXT;
  v_meta JSONB;
BEGIN
  IF p_suggestion_id IS NULL OR trim(p_suggestion_id) = '' THEN
    RAISE EXCEPTION 'INVALID_SUGGESTION_ID';
  END IF;
  IF p_target_code IS NULL OR trim(p_target_code) = '' THEN
    RAISE EXCEPTION 'INVALID_TARGET_CODE';
  END IF;
  IF p_target_type NOT IN ('country', 'region', 'city', 'district') THEN
    RAISE EXCEPTION 'INVALID_TARGET_TYPE';
  END IF;

  SELECT * INTO v_row
  FROM public.location_suggestions
  WHERE id = p_suggestion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUGGESTION_NOT_FOUND';
  END IF;

  IF v_row.status <> 'PENDING' THEN
    RAISE EXCEPTION 'SUGGESTION_NOT_PENDING';
  END IF;

  v_raw_lower := lower(trim(v_row.raw_term));

  INSERT INTO public.geo_synonyms (target_code, target_type, lang, alias_term, weight)
  VALUES (trim(p_target_code), p_target_type, COALESCE(NULLIF(trim(p_synonym_lang), ''), '*'), v_row.raw_term, 90)
  ON CONFLICT (lower(alias_term), lang)
  DO UPDATE SET
    target_code = EXCLUDED.target_code,
    target_type = EXCLUDED.target_type,
    weight = GREATEST(public.geo_synonyms.weight, EXCLUDED.weight)
  RETURNING id INTO v_synonym_id;

  IF v_row.kind = 'city' THEN
    UPDATE public.listings l
    SET
      city_code = trim(p_target_code),
      country_code = COALESCE(v_row.country_code, l.country_code),
      region_code = COALESCE(v_row.region_code, l.region_code),
      metadata = (COALESCE(l.metadata, '{}'::jsonb) - 'unverified_location')
        || jsonb_build_object('geo_status', 'verified'),
      updated_at = now()
    WHERE l.status = 'ACTIVE'
      AND (
        lower(trim(l.metadata->'unverified_location'->>'raw_term')) = v_raw_lower
        OR lower(trim(l.district)) = v_raw_lower
        OR (v_row.suggested_by_listing_id IS NOT NULL AND l.id = v_row.suggested_by_listing_id)
      );
  ELSE
    UPDATE public.listings l
    SET
      district = trim(p_target_code),
      country_code = COALESCE(v_row.country_code, l.country_code),
      region_code = COALESCE(v_row.region_code, l.region_code),
      city_code = COALESCE(v_row.city_code, l.city_code),
      metadata = (COALESCE(l.metadata, '{}'::jsonb) - 'unverified_location')
        || jsonb_build_object('geo_status', 'verified'),
      updated_at = now()
    WHERE l.status = 'ACTIVE'
      AND (
        lower(trim(l.district)) = v_raw_lower
        OR lower(trim(l.metadata->'unverified_location'->>'raw_term')) = v_raw_lower
        OR (v_row.suggested_by_listing_id IS NOT NULL AND l.id = v_row.suggested_by_listing_id)
      );
  END IF;

  GET DIAGNOSTICS v_merged_count = ROW_COUNT;

  UPDATE public.location_suggestions
  SET
    status = 'MERGED',
    resolved_at = now(),
    resolved_by = p_resolved_by,
    merge_target_code = trim(p_target_code),
    merge_target_type = p_target_type
  WHERE id = p_suggestion_id;

  RETURN jsonb_build_object(
    'merged_listings_count', v_merged_count,
    'synonym_id', v_synonym_id,
    'suggestion_id', p_suggestion_id,
    'raw_term', v_row.raw_term,
    'target_code', trim(p_target_code),
    'target_type', p_target_type
  );
END;
$$;

COMMENT ON FUNCTION public.resolve_location_suggestion_merge_v1 IS
  'Stage 160 — atomic MERGE for location_suggestions (synonym + listings + status).';

GRANT EXECUTE ON FUNCTION public.count_listings_for_location_term_v1(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_location_suggestion_merge_v1(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
