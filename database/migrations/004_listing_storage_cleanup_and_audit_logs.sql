-- ============================================================================
-- Gostaylo — storage cleanup on listing delete + audit_logs for bookings/payments
-- Выполнить в Supabase SQL Editor (роль с правами на storage.objects и public.*).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Удаление файлов Storage при физическом DELETE из public.listings
--    Папка объекта: {listing_id}/... в бакете listing-images (и legacy listings).
--    Не срабатывает при soft-delete (UPDATE status), только при DELETE.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_listing_storage_on_row_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_key text;
BEGIN
  listing_key := OLD.id::text;

  DELETE FROM storage.objects
  WHERE bucket_id = 'listing-images'
    AND (name = listing_key OR name LIKE listing_key || '/%');

  DELETE FROM storage.objects
  WHERE bucket_id = 'listings'
    AND (name = listing_key OR name LIKE listing_key || '/%');

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.delete_listing_storage_on_row_delete() IS
  'Removes all objects under listing id prefix from listing-images and legacy listings bucket.';

DROP TRIGGER IF EXISTS trg_listings_delete_storage_cleanup ON public.listings;

CREATE TRIGGER trg_listings_delete_storage_cleanup
  BEFORE DELETE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_listing_storage_on_row_delete();

-- ---------------------------------------------------------------------------
-- 2) Таблица журнала аудита
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);

COMMENT ON TABLE public.audit_logs IS 'Append-only audit trail for bookings/payments (DB triggers).';

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Нет политик для anon/authenticated: чтение только через service role / dashboard SQL.
-- Запись — только триггерами под SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- 3) Триггеры: bookings (INSERT / UPDATE / DELETE)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.audit_booking_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid text;
BEGIN
  BEGIN
    uid := nullif(auth.uid()::text, '');
  EXCEPTION WHEN OTHERS THEN
    uid := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, payload)
    VALUES (
      uid,
      'booking.delete',
      'booking',
      OLD.id::text,
      jsonb_build_object('before', to_jsonb(OLD))
    );
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, payload)
    VALUES (
      uid,
      'booking.insert',
      'booking',
      NEW.id::text,
      jsonb_build_object('after', to_jsonb(NEW))
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, payload)
    VALUES (
      uid,
      'booking.update',
      'booking',
      NEW.id::text,
      jsonb_build_object(
        'before', to_jsonb(OLD),
        'after', to_jsonb(NEW),
        'status_change',
        CASE WHEN OLD.status IS DISTINCT FROM NEW.status
          THEN jsonb_build_object('from', OLD.status, 'to', NEW.status)
          ELSE NULL
        END
      )
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_audit_insert ON public.bookings;
DROP TRIGGER IF EXISTS trg_bookings_audit_update ON public.bookings;
DROP TRIGGER IF EXISTS trg_bookings_audit_delete ON public.bookings;

CREATE TRIGGER trg_bookings_audit_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_booking_row();

CREATE TRIGGER trg_bookings_audit_update
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_booking_row();

CREATE TRIGGER trg_bookings_audit_delete
  AFTER DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_booking_row();

-- ---------------------------------------------------------------------------
-- 4) Триггеры: payments (INSERT / UPDATE / DELETE) — каждое изменение статуса в payload
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.audit_payment_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid text;
BEGIN
  BEGIN
    uid := nullif(auth.uid()::text, '');
  EXCEPTION WHEN OTHERS THEN
    uid := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, payload)
    VALUES (
      uid,
      'payment.delete',
      'payment',
      OLD.id::text,
      jsonb_build_object('before', to_jsonb(OLD), 'booking_id', OLD.booking_id::text)
    );
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, payload)
    VALUES (
      uid,
      'payment.insert',
      'payment',
      NEW.id::text,
      jsonb_build_object('after', to_jsonb(NEW), 'booking_id', NEW.booking_id::text)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, payload)
    VALUES (
      uid,
      'payment.update',
      'payment',
      NEW.id::text,
      jsonb_build_object(
        'before', to_jsonb(OLD),
        'after', to_jsonb(NEW),
        'booking_id', NEW.booking_id::text,
        'status_change',
        CASE WHEN OLD.status IS DISTINCT FROM NEW.status
          THEN jsonb_build_object('from', OLD.status, 'to', NEW.status)
          ELSE NULL
        END
      )
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_audit_insert ON public.payments;
DROP TRIGGER IF EXISTS trg_payments_audit_update ON public.payments;
DROP TRIGGER IF EXISTS trg_payments_audit_delete ON public.payments;

CREATE TRIGGER trg_payments_audit_insert
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_payment_row();

CREATE TRIGGER trg_payments_audit_update
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_payment_row();

CREATE TRIGGER trg_payments_audit_delete
  AFTER DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_payment_row();
