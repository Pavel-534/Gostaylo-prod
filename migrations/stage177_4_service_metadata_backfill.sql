-- Stage 177.4 — normalize service/nanny metadata for unified SQL facets
-- SSOT write keys: lib/partner/listing-wizard-metadata.js, lib/config/category-form-schema.js
-- Idempotent; safe to re-run before/after DISCOVERY_UNIFIED_PIPELINE service SQL rollout

BEGIN;

-- 1) experience_years: consolidate legacy numeric fields
UPDATE public.listings l
SET metadata = jsonb_set(
  COALESCE(l.metadata, '{}'::jsonb),
  '{experience_years}',
  to_jsonb(
    GREATEST(0, LEAST(80,
      COALESCE(
        NULLIF(regexp_replace(COALESCE(l.metadata->>'experience_years', ''), '[^0-9]', '', 'g'), '')::int,
        NULLIF(regexp_replace(COALESCE(l.metadata->>'experience', ''), '[^0-9]', '', 'g'), '')::int,
        NULLIF(regexp_replace(COALESCE(l.metadata->>'years_experience', ''), '[^0-9]', '', 'g'), '')::int
      )
    ))
  ),
  true
)
WHERE l.status = 'ACTIVE'
  AND (
    l.metadata ? 'experience'
    OR l.metadata ? 'years_experience'
    OR (l.metadata->>'experience_years') IS NULL
  )
  AND COALESCE(
    NULLIF(regexp_replace(COALESCE(l.metadata->>'experience_years', ''), '[^0-9]', '', 'g'), '')::int,
    NULLIF(regexp_replace(COALESCE(l.metadata->>'experience', ''), '[^0-9]', '', 'g'), '')::int,
    NULLIF(regexp_replace(COALESCE(l.metadata->>'years_experience', ''), '[^0-9]', '', 'g'), '')::int
  ) IS NOT NULL;

-- 2) languages: string CSV / legacy keys → canonical string[] (ru|en|th|zh)
UPDATE public.listings l
SET metadata = jsonb_set(
  COALESCE(l.metadata, '{}'::jsonb),
  '{languages}',
  (
    SELECT COALESCE(jsonb_agg(DISTINCT code ORDER BY code), '[]'::jsonb)
    FROM (
      SELECT lower(trim(x)) AS code
      FROM unnest(
        string_to_array(
          COALESCE(
            NULLIF(l.metadata->>'languages', ''),
            NULLIF(l.metadata->>'languages_spoken', ''),
            NULLIF(l.metadata->>'language', '')
          ),
          ',;'
        )
      ) AS t(x)
      WHERE lower(trim(x)) IN ('ru', 'en', 'th', 'zh')
    ) s
  ),
  true
)
WHERE l.status = 'ACTIVE'
  AND jsonb_typeof(l.metadata->'languages') IS DISTINCT FROM 'array'
  AND (
    l.metadata ? 'languages'
    OR l.metadata ? 'languages_spoken'
    OR l.metadata ? 'language'
  );

-- 3) home_visit: normalize string 'true' / '1' → boolean true
UPDATE public.listings l
SET metadata = jsonb_set(
  COALESCE(l.metadata, '{}'::jsonb),
  '{home_visit}',
  'true'::jsonb,
  true
)
WHERE l.status = 'ACTIVE'
  AND (
    l.metadata->>'home_visit' IN ('true', '1')
    OR l.metadata->'home_visit' = 'true'::jsonb
  );

-- 4) specialization: legacy text keys → canonical specialization (when empty)
WITH legacy_spec AS (
  SELECT
    l.id,
    left(
      trim(
        regexp_replace(
          concat_ws(
            ' ',
            CASE
              WHEN jsonb_typeof(l.metadata->'specialities') = 'array' THEN (
                SELECT NULLIF(string_agg(btrim(x), ' '), '')
                FROM jsonb_array_elements_text(l.metadata->'specialities') AS t(x)
                WHERE btrim(x) <> ''
              )
              ELSE NULLIF(btrim(l.metadata->>'specialities'), '')
            END,
            NULLIF(btrim(l.metadata->>'specialty'), ''),
            CASE
              WHEN jsonb_typeof(l.metadata->'skills') = 'array' THEN (
                SELECT NULLIF(string_agg(btrim(x), ' '), '')
                FROM jsonb_array_elements_text(l.metadata->'skills') AS t(x)
                WHERE btrim(x) <> ''
              )
              ELSE NULLIF(btrim(l.metadata->>'skills'), '')
            END
          ),
          '\s+',
          ' ',
          'g'
        )
      ),
      500
    ) AS merged_text
  FROM public.listings l
  WHERE l.status = 'ACTIVE'
    AND NULLIF(btrim(COALESCE(l.metadata->>'specialization', '')), '') IS NULL
    AND (
      l.metadata ? 'specialities'
      OR l.metadata ? 'specialty'
      OR l.metadata ? 'skills'
    )
)
UPDATE public.listings l
SET metadata = jsonb_set(
  COALESCE(l.metadata, '{}'::jsonb),
  '{specialization}',
  to_jsonb(legacy_spec.merged_text),
  true
)
FROM legacy_spec
WHERE l.id = legacy_spec.id
  AND legacy_spec.merged_text IS NOT NULL
  AND length(legacy_spec.merged_text) > 0;

COMMIT;
