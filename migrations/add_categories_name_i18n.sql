-- Stage 69.0 — optional localized display names (SSOT over ad-hoc localStorage).
-- Future: can migrate rows to dedicated `category_i18n` table; until then JSONB is canonical in API.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS name_i18n JSONB DEFAULT NULL;

COMMENT ON COLUMN public.categories.name_i18n IS 'Stage 69.0: optional {"ru","en","zh","th"} strings; API exposes as nameI18n.';
