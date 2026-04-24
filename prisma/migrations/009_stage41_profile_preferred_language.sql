-- Stage 41.0 — optional UI locale override for notifications / future i18n (Supabase).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(12);
COMMENT ON COLUMN profiles.preferred_language IS 'Guest UI locale override (ru|en|zh|th). Falls back to language column, then en.';
