-- Stage 202.28 — Ulan-Ude (Buryatia) launch geo nodes for partner wizard + assertListingGeoCodes
-- Idempotent upsert; safe to re-run after seed-geo-locations.mjs.

INSERT INTO public.geo_locations (
  code, level, parent_code, label_en, label_ru, iso_country, country_code,
  centroid_lat, centroid_lng, timezone, is_active, is_auto_imported, updated_at
)
VALUES
  (
    'RU-BU', 'region', 'RU', 'Republic of Buryatia', 'Республика Бурятия',
    'RU', 'RU', 51.8335, 107.5841, 'Asia/Irkutsk', true, false, now()
  ),
  (
    'ulan-ude', 'city', 'RU-BU', 'Ulan-Ude', 'Улан-Удэ',
    'RU', 'RU', 51.8335, 107.5841, 'Asia/Irkutsk', true, false, now()
  )
ON CONFLICT (code) DO UPDATE SET
  level = EXCLUDED.level,
  parent_code = EXCLUDED.parent_code,
  label_en = EXCLUDED.label_en,
  label_ru = EXCLUDED.label_ru,
  iso_country = EXCLUDED.iso_country,
  country_code = EXCLUDED.country_code,
  centroid_lat = EXCLUDED.centroid_lat,
  centroid_lng = EXCLUDED.centroid_lng,
  timezone = EXCLUDED.timezone,
  is_active = EXCLUDED.is_active,
  is_auto_imported = EXCLUDED.is_auto_imported,
  updated_at = now();

INSERT INTO public.geo_synonyms (target_code, target_type, lang, alias_term, weight)
VALUES
  ('ulan-ude', 'city', 'ru', 'улан-удэ', 100),
  ('ulan-ude', 'city', 'ru', 'улан удэ', 95),
  ('ulan-ude', 'city', '*', 'ulan-ude', 100),
  ('ulan-ude', 'city', '*', 'ulan ude', 95),
  ('RU-BU', 'region', 'ru', 'бурятия', 100),
  ('RU-BU', 'region', 'ru', 'республика бурятия', 95)
ON CONFLICT DO NOTHING;
