-- Stage 68.0 — category hierarchy (parent → children). Listings stay on leaf category_id;
-- search by parent slug expands to IN (parent_id, child_ids).
--
-- parent_id MUST match the type of categories.id. Legacy DBs use TEXT ids; use TEXT + FK below.
-- If your categories.id is UUID, replace TEXT with UUID in this file before applying.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id)
  WHERE parent_id IS NOT NULL;

COMMENT ON COLUMN public.categories.parent_id IS 'Stage 68.0: parent category; NULL = root.';
