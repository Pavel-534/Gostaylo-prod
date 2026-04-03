-- =============================================================================
-- STEP 2 of 2 — Run ONLY after 013a_user_role_add_moderator_enum.sql succeeded.
-- (Separate query tab / second Run — not in the same batch as ADD VALUE.)
-- =============================================================================

-- Promote users who used "[MODERATOR]" in last_name; preserve ADMIN.
UPDATE profiles
SET
  role = 'MODERATOR'::user_role,
  last_name = NULLIF(
    TRIM(REGEXP_REPLACE(COALESCE(last_name, ''), '\s*\[MODERATOR\]\s*', '', 'gi')),
    ''
  )
WHERE last_name ~* '\[MODERATOR\]'
  AND role::text <> 'ADMIN';

-- Clean marker from last_name for remaining rows (e.g. ADMIN test accounts)
UPDATE profiles
SET last_name = NULLIF(
  TRIM(REGEXP_REPLACE(COALESCE(last_name, ''), '\s*\[MODERATOR\]\s*', '', 'gi')),
  ''
)
WHERE last_name ~* '\[MODERATOR\]';
