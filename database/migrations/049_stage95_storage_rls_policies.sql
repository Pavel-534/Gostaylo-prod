-- Stage 95.0 — Storage hardening (post Stage 94 RLS).
-- Prerequisites: public.current_profile_id(), public.is_admin() (022 / 048).
-- Uploads remain via POST /api/v2/upload (service_role); policies block direct anon/authenticated abuse.

-- =============================================================================
-- Buckets (idempotent)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('avatars', 'avatars', true, 10485760),
  ('listing-images', 'listing-images', true, 10485760),
  ('listings', 'listings', true, 10485760),
  ('verification_documents', 'verification_documents', true, 10485760),
  ('chat-attachments', 'chat-attachments', true, 10485760),
  ('review-images', 'review-images', true, 10485760),
  ('dispute-evidence', 'dispute-evidence', false, 10485760)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  public = CASE
    WHEN storage.buckets.id = 'dispute-evidence' THEN false
    ELSE EXCLUDED.public
  END;

-- =============================================================================
-- Path helpers (SECURITY DEFINER — safe column names only)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.storage_object_segment(p_name text, p_idx int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(split_part(COALESCE(p_name, ''), '/', GREATEST(1, p_idx)), '')
$$;

COMMENT ON FUNCTION public.storage_object_segment(text, int) IS
  'Nth path segment of storage.objects.name (1-based).';

CREATE OR REPLACE FUNCTION public.storage_can_write_listing_images_object(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pid text;
  v_seg1 text;
  v_seg2 text;
  v_listing_id text;
BEGIN
  v_pid := public.current_profile_id();
  IF v_pid IS NULL THEN
    RETURN false;
  END IF;
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  v_seg1 := public.storage_object_segment(p_name, 1);
  v_seg2 := public.storage_object_segment(p_name, 2);

  -- Legacy avatars under listing-images/avatars/{profileId}/…
  IF v_seg1 = 'avatars' THEN
    RETURN v_seg2 = v_pid;
  END IF;

  v_listing_id := v_seg1;
  IF v_listing_id IS NULL OR v_listing_id = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.listings l
    WHERE l.id::text = v_listing_id
      AND l.owner_id::text = v_pid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.storage_can_write_avatar_object(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      public.current_profile_id() IS NOT NULL
      AND public.storage_object_segment(p_name, 1) = public.current_profile_id()
    )
$$;

CREATE OR REPLACE FUNCTION public.storage_can_write_verification_doc(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = public.current_profile_id()
        AND p.role IN ('ADMIN'::public.user_role, 'MODERATOR'::public.user_role)
    )
    OR public.storage_object_segment(p_name, 1) = public.current_profile_id()
$$;

CREATE OR REPLACE FUNCTION public.storage_can_read_verification_doc(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.storage_can_write_verification_doc(p_name)
$$;

CREATE OR REPLACE FUNCTION public.storage_can_write_chat_attachment(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.storage_object_segment(p_name, 1) = public.current_profile_id()
$$;

-- =============================================================================
-- Drop legacy / duplicate policies (safe if missing)
-- =============================================================================

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
DROP POLICY IF EXISTS avatars_owner_write ON storage.objects;
DROP POLICY IF EXISTS avatars_owner_update ON storage.objects;
DROP POLICY IF EXISTS avatars_owner_delete ON storage.objects;
DROP POLICY IF EXISTS listing_images_public_read ON storage.objects;
DROP POLICY IF EXISTS listing_images_owner_write ON storage.objects;
DROP POLICY IF EXISTS listing_images_owner_update ON storage.objects;
DROP POLICY IF EXISTS listing_images_owner_delete ON storage.objects;
DROP POLICY IF EXISTS listings_legacy_public_read ON storage.objects;
DROP POLICY IF EXISTS listings_legacy_owner_write ON storage.objects;
DROP POLICY IF EXISTS verification_docs_owner_read ON storage.objects;
DROP POLICY IF EXISTS verification_docs_owner_write ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_public_read ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_owner_write ON storage.objects;
DROP POLICY IF EXISTS review_images_public_read ON storage.objects;
DROP POLICY IF EXISTS review_images_owner_write ON storage.objects;

-- =============================================================================
-- avatars — public read; write only {profileId}/…
-- =============================================================================

CREATE POLICY avatars_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY avatars_owner_write
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.storage_can_write_avatar_object(name)
  );

CREATE POLICY avatars_owner_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND public.storage_can_write_avatar_object(name))
  WITH CHECK (bucket_id = 'avatars' AND public.storage_can_write_avatar_object(name));

CREATE POLICY avatars_owner_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND public.storage_can_write_avatar_object(name));

-- =============================================================================
-- listing-images + legacy listings bucket
-- =============================================================================

CREATE POLICY listing_images_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'listing-images');

CREATE POLICY listing_images_owner_write
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'listing-images'
    AND public.storage_can_write_listing_images_object(name)
  );

CREATE POLICY listing_images_owner_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'listing-images'
    AND public.storage_can_write_listing_images_object(name)
  )
  WITH CHECK (
    bucket_id = 'listing-images'
    AND public.storage_can_write_listing_images_object(name)
  );

CREATE POLICY listing_images_owner_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'listing-images'
    AND public.storage_can_write_listing_images_object(name)
  );

CREATE POLICY listings_legacy_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'listings');

CREATE POLICY listings_legacy_owner_write
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'listings'
    AND public.storage_can_write_listing_images_object(name)
  );

-- =============================================================================
-- verification_documents — owner + staff read/write (bucket may stay public for legacy /_storage proxy)
-- =============================================================================

CREATE POLICY verification_docs_owner_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification_documents'
    AND public.storage_can_read_verification_doc(name)
  );

CREATE POLICY verification_docs_owner_write
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'verification_documents'
    AND public.storage_can_write_verification_doc(name)
  );

-- =============================================================================
-- chat-attachments, review-images — public read; folder = profile id
-- =============================================================================

CREATE POLICY chat_attachments_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'chat-attachments');

CREATE POLICY chat_attachments_owner_write
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.storage_can_write_chat_attachment(name)
  );

CREATE POLICY review_images_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'review-images');

CREATE POLICY review_images_owner_write
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'review-images'
    AND public.storage_object_segment(name, 1) = public.current_profile_id()
  );

-- =============================================================================
-- dispute-evidence — replace 043 policy to use current_profile_id() + booking party
-- =============================================================================

DROP POLICY IF EXISTS dispute_evidence_select_staff_or_booking_party ON storage.objects;

DO $$
DECLARE
  v_renter_col text;
  v_sql text;
BEGIN
  SELECT c.column_name INTO v_renter_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'bookings'
    AND c.column_name IN ('renter_id', 'user_id', 'guest_id')
  ORDER BY
    CASE c.column_name
      WHEN 'renter_id' THEN 1
      WHEN 'user_id' THEN 2
      WHEN 'guest_id' THEN 3
    END
  LIMIT 1;

  IF v_renter_col IS NULL THEN
    RAISE NOTICE 'Stage 95: skip dispute-evidence policy — no bookings guest column';
    RETURN;
  END IF;

  v_sql := format($pol$
    CREATE POLICY dispute_evidence_select_staff_or_booking_party
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'dispute-evidence'
      AND (
        public.is_admin()
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = public.current_profile_id()
            AND p.role = 'MODERATOR'::public.user_role
        )
        OR EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.id::text = trim(regexp_replace(split_part(name, '/', 1), '^booking-', ''))
            AND (
              b.%I::text = public.current_profile_id()
              OR b.partner_id::text = public.current_profile_id()
              OR EXISTS (
                SELECT 1 FROM public.listings l
                WHERE l.id = b.listing_id AND l.owner_id::text = public.current_profile_id()
              )
            )
        )
      )
    )
  $pol$, v_renter_col);

  EXECUTE v_sql;
END $$;
