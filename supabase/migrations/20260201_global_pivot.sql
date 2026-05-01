-- =====================================================================
-- Migration: Global Pivot — Country / Region / City hierarchy
-- Date: 2026-02-01
-- Sprint: Global Database & Geo-Logic
--
-- Purpose: подготовить таблицу listings к глобальному агрегатору.
-- Сохраняет обратную совместимость: district остаётся (теперь = neighborhood
-- внутри города), новые поля nullable для постепенной миграции.
--
-- Apply:
--   Option A (recommended) — Supabase Dashboard → SQL Editor → paste & Run.
--   Option B — psql:  psql "$SUPABASE_DB_URL" -f 20260201_global_pivot.sql
--   Option C — Node script: /app/scripts/migrate-global-pivot.mjs (auto-detects DB_URL).
--
-- Idempotent: ALL statements use IF NOT EXISTS / WHERE NOT EXISTS guards.
-- =====================================================================

BEGIN;

-- 1) Add new columns (nullable; backfill below) -----------------------
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS region_code  TEXT,
  ADD COLUMN IF NOT EXISTS city_code    TEXT;

COMMENT ON COLUMN public.listings.country_code IS 'ISO 3166-1 alpha-2 (TH, RU, ID, AE, ...)';
COMMENT ON COLUMN public.listings.region_code  IS 'ISO 3166-2-like region code (TH-PHK, RU-MOW, ...)';
COMMENT ON COLUMN public.listings.city_code    IS 'Slug of city (phuket-city, moscow, denpasar, ...)';

-- 2) Backfill existing Phuket listings -------------------------------
-- Все объекты с district в районах Пхукета считаем TH / TH-PHK / phuket-city.
-- Для записей с district NULL — оставляем NULL (партнёр заполнит при апдейте).
UPDATE public.listings
   SET country_code = COALESCE(country_code, 'TH'),
       region_code  = COALESCE(region_code,  'TH-PHK'),
       city_code    = COALESCE(city_code,    'phuket-city')
 WHERE district IS NOT NULL
   AND (country_code IS NULL OR region_code IS NULL OR city_code IS NULL);

-- 3) Indexes for global geo-search ----------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_country_code ON public.listings (country_code);
CREATE INDEX IF NOT EXISTS idx_listings_region_code  ON public.listings (region_code);
CREATE INDEX IF NOT EXISTS idx_listings_city_code    ON public.listings (city_code);

-- Composite index for hierarchical queries (country → region → city)
CREATE INDEX IF NOT EXISTS idx_listings_geo_hierarchy
  ON public.listings (country_code, region_code, city_code)
  WHERE status = 'ACTIVE';

-- 4) Lightweight reference table (optional, pure metadata) ----------
-- Для UI selectов / SSR fallback. Frontend cascade source-of-truth остаётся
-- /app/lib/geo/country-presets.js, но эта таблица позволит партнёрам
-- запрашивать список через REST если нужно.
CREATE TABLE IF NOT EXISTS public.geo_locations (
  id           SERIAL PRIMARY KEY,
  level        TEXT NOT NULL CHECK (level IN ('country', 'region', 'city')),
  code         TEXT NOT NULL,
  parent_code  TEXT,
  label_en     TEXT NOT NULL,
  label_ru     TEXT,
  label_zh     TEXT,
  label_th     TEXT,
  flag         TEXT,
  iso_country  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (level, code)
);

CREATE INDEX IF NOT EXISTS idx_geo_locations_level_code ON public.geo_locations (level, code);
CREATE INDEX IF NOT EXISTS idx_geo_locations_parent     ON public.geo_locations (parent_code);

-- Seed: страны (5 для старта — добавлена Турция)
INSERT INTO public.geo_locations (level, code, parent_code, label_en, label_ru, label_zh, label_th, flag, iso_country) VALUES
  ('country', 'TH', NULL, 'Thailand',  'Таиланд',  '泰国',          'ประเทศไทย', '🇹🇭', 'TH'),
  ('country', 'RU', NULL, 'Russia',    'Россия',   '俄罗斯',        'รัสเซีย',    '🇷🇺', 'RU'),
  ('country', 'ID', NULL, 'Indonesia', 'Индонезия','印度尼西亚',     'อินโดนีเซีย','🇮🇩', 'ID'),
  ('country', 'AE', NULL, 'UAE',       'ОАЭ',      '阿联酋',        'ยูเออี',      '🇦🇪', 'AE'),
  ('country', 'TR', NULL, 'Turkey',    'Турция',   '土耳其',        'ตุรกี',      '🇹🇷', 'TR')
ON CONFLICT (level, code) DO NOTHING;

-- Seed: регионы
INSERT INTO public.geo_locations (level, code, parent_code, label_en, label_ru, label_zh, label_th, iso_country) VALUES
  ('region', 'TH-PHK', 'TH', 'Phuket',           'Пхукет',           '普吉府',     'ภูเก็ต',          'TH'),
  ('region', 'TH-BKK', 'TH', 'Bangkok',          'Бангкок',          '曼谷',       'กรุงเทพ',         'TH'),
  ('region', 'TH-SUR', 'TH', 'Surat Thani',      'Сурат-Тани',       '素叻府',     'สุราษฎร์ธานี',     'TH'),
  ('region', 'TH-KRA', 'TH', 'Krabi',            'Краби',            '甲米府',     'กระบี่',          'TH'),
  ('region', 'RU-MOW', 'RU', 'Moscow',           'Москва',           '莫斯科市',   'มอสโก',           'RU'),
  ('region', 'RU-SPB', 'RU', 'Saint Petersburg', 'Санкт-Петербург',  '圣彼得堡市', 'เซนต์ปีเตอร์สเบิร์ก','RU'),
  ('region', 'RU-KDA', 'RU', 'Krasnodar Krai',   'Краснодарский край','克拉斯诺达尔','ครัสโนดาร์',     'RU'),
  ('region', 'ID-BA',  'ID', 'Bali',             'Бали',             '巴厘省',     'บาหลี',           'ID'),
  ('region', 'ID-JK',  'ID', 'Jakarta',          'Джакарта',         '雅加达',     'จาการ์ตา',        'ID'),
  ('region', 'AE-DU',  'AE', 'Dubai',            'Дубай',            '迪拜',       'ดูไบ',            'AE'),
  ('region', 'AE-AZ',  'AE', 'Abu Dhabi',        'Абу-Даби',         '阿布扎比',   'อาบูดาบี',        'AE'),
  ('region', 'TR-34',  'TR', 'Istanbul',         'Стамбул',          '伊斯坦布尔省','อิสตันบูล',      'TR'),
  ('region', 'TR-07',  'TR', 'Antalya',          'Анталия',          '安塔利亚省', 'อันตัลยา',        'TR'),
  ('region', 'TR-48',  'TR', 'Muğla',            'Мугла',            '穆拉省',     'มูลา',            'TR')
ON CONFLICT (level, code) DO NOTHING;

-- Seed: города
INSERT INTO public.geo_locations (level, code, parent_code, label_en, label_ru, label_zh, label_th, iso_country) VALUES
  ('city', 'phuket-city', 'TH-PHK', 'Phuket',     'Пхукет',           '普吉镇',     'เมืองภูเก็ต',     'TH'),
  ('city', 'bangkok',     'TH-BKK', 'Bangkok',    'Бангкок',          '曼谷',       'กรุงเทพ',         'TH'),
  ('city', 'samui',       'TH-SUR', 'Koh Samui',  'Самуи',            '苏梅岛',     'เกาะสมุย',        'TH'),
  ('city', 'krabi-city',  'TH-KRA', 'Krabi',      'Краби',            '甲米',       'กระบี่',          'TH'),
  ('city', 'moscow',      'RU-MOW', 'Moscow',     'Москва',           '莫斯科',     'มอสโก',           'RU'),
  ('city', 'spb',         'RU-SPB', 'Saint Petersburg', 'Санкт-Петербург', '圣彼得堡', 'เซนต์ปีเตอร์สเบิร์ก','RU'),
  ('city', 'sochi',       'RU-KDA', 'Sochi',      'Сочи',             '索契',       'โซชี',            'RU'),
  ('city', 'denpasar',    'ID-BA',  'Denpasar',   'Денпасар',         '登巴萨',     'เดนปาซาร์',       'ID'),
  ('city', 'ubud',        'ID-BA',  'Ubud',       'Убуд',             '乌布',       'อูบุด',           'ID'),
  ('city', 'uluwatu',     'ID-BA',  'Uluwatu',    'Улувату',          '乌鲁瓦图',   'อูลูวาตู',        'ID'),
  ('city', 'jakarta',     'ID-JK',  'Jakarta',    'Джакарта',         '雅加达',     'จาการ์ตา',        'ID'),
  ('city', 'dubai',       'AE-DU',  'Dubai',      'Дубай',            '迪拜',       'ดูไบ',            'AE'),
  ('city', 'abu-dhabi',   'AE-AZ',  'Abu Dhabi',  'Абу-Даби',         '阿布扎比',   'อาบูดาบี',        'AE'),
  ('city', 'istanbul',    'TR-34',  'Istanbul',   'Стамбул',          '伊斯坦布尔', 'อิสตันบูล',       'TR'),
  ('city', 'antalya',     'TR-07',  'Antalya',    'Анталия',          '安塔利亚',   'อันตัลยา',        'TR'),
  ('city', 'bodrum',      'TR-48',  'Bodrum',     'Бодрум',           '博德鲁姆',   'บอดรุม',          'TR'),
  ('city', 'fethiye',     'TR-48',  'Fethiye',    'Фетхие',           '费特希耶',   'เฟทิเย',          'TR')
ON CONFLICT (level, code) DO NOTHING;

-- 5) RLS policy — публичное чтение справочника -----------------------
ALTER TABLE public.geo_locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='geo_locations' AND policyname='geo_locations_public_read') THEN
    CREATE POLICY "geo_locations_public_read"
      ON public.geo_locations FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Verification (run after COMMIT, in separate session):
--   SELECT COUNT(*) FILTER (WHERE country_code IS NOT NULL) AS migrated,
--          COUNT(*)                                          AS total
--     FROM public.listings;
--
--   SELECT level, COUNT(*) FROM public.geo_locations GROUP BY level;
-- =====================================================================
