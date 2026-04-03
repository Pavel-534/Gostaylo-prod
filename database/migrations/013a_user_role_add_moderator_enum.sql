-- =============================================================================
-- STEP 1 of 2 — Run THIS FILE ALONE first, then click Run (green button).
-- =============================================================================
-- PostgreSQL commits new enum labels only after the statement finishes.
-- If you combine ADD VALUE and UPDATE profiles in one script, you get:
--   ERROR 55P04: unsafe use of new value "MODERATOR" of enum type user_role
--   Hint: New enum values must be committed before they can be used.
-- =============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MODERATOR';

-- After success: open and run 013b_user_role_migrate_legacy_moderator.sql
