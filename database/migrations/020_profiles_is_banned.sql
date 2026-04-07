-- Ban flag for instant lockout (middleware + login); pair with Supabase Auth ban_duration in app code.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON profiles(is_banned) WHERE is_banned = true;

COMMENT ON COLUMN profiles.is_banned IS 'When true, app JWT routes reject; set with Telegram admin ban + Auth ban.';
