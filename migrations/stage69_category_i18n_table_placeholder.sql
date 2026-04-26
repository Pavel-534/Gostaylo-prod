-- Stage 69.0 — groundwork for normalized i18n (not wired in API yet).
-- Run when you want DB-level constraints instead of JSONB on `categories`.

/*
CREATE TABLE IF NOT EXISTS public.category_i18n (
  category_id TEXT NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  lang_code TEXT NOT NULL CHECK (lang_code IN ('ru', 'en', 'zh', 'th')),
  name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, lang_code)
);

CREATE INDEX IF NOT EXISTS idx_category_i18n_lang ON public.category_i18n (lang_code);
*/
