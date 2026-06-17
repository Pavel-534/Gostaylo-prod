-- Stage 157 — popular discovery chip cities (Pattaya, Kazan) for geo_locations FK + search.
-- Idempotent: ON CONFLICT DO NOTHING.

BEGIN;

INSERT INTO public.geo_locations (level, code, parent_code, label_en, label_ru, label_zh, label_th, iso_country) VALUES
  ('region', 'TH-PTY', 'TH', 'Pattaya', 'Паттайя', '芭堤雅', 'พัทยา', 'TH'),
  ('city', 'pattaya', 'TH-PTY', 'Pattaya', 'Паттайя', '芭堤雅', 'พัทยา', 'TH'),
  ('region', 'RU-TA', 'RU', 'Tatarstan', 'Татарстан', '鞑靼斯坦', 'ตาตาร์สถาน', 'RU'),
  ('city', 'kazan', 'RU-TA', 'Kazan', 'Казань', '喀山', 'คาซาน', 'RU')
ON CONFLICT (level, code) DO NOTHING;

COMMIT;
