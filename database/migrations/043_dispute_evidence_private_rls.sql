-- Dispute evidence: private bucket + read policy for staff and booking parties.
-- Path convention: booking-{booking_id}/... (see /api/v2/upload + dispute flow).

UPDATE storage.buckets
SET public = false
WHERE id = 'dispute-evidence';

-- NB: не вызывайте ALTER TABLE на storage.objects в SQL Editor: таблица не принадлежит роли
-- postgres → ERROR 42501 "must be owner of table objects". RLS на storage.objects у Supabase
-- уже включён платформой.

DROP POLICY IF EXISTS dispute_evidence_select_staff_or_booking_party ON storage.objects;

CREATE POLICY dispute_evidence_select_staff_or_booking_party
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'dispute-evidence'
  AND (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      -- profiles.id в БД TEXT; auth.uid() — uuid (см. 021_realtime_messages_grants.sql)
      WHERE p.id = auth.uid()::text
        AND p.role IN ('ADMIN'::public.user_role, 'MODERATOR'::public.user_role)
    )
    OR EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE NULLIF(trim(regexp_replace(split_part(name, '/', 1), '^booking-', '')), '') IS NOT NULL
        AND b.id::text = trim(regexp_replace(split_part(name, '/', 1), '^booking-', ''))
        AND (b.renter_id::text = auth.uid()::text OR b.partner_id::text = auth.uid()::text)
    )
  )
);
