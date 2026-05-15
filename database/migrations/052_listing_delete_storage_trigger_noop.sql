-- Stage 95.5 / 96.1 — Supabase запрещает DELETE FROM storage.objects (только Storage API).
-- Старый BEFORE DELETE триггер ломал физическое удаление listings (E2E cleanup, админ).
-- Файлы под префиксом listing id: Storage API (cleanup-test-data, storage-cleanup cron).

CREATE OR REPLACE FUNCTION public.delete_listing_storage_on_row_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.delete_listing_storage_on_row_delete() IS
  'No-op: storage.objects must be removed via Storage API before/after listing DELETE. See lib/e2e/cleanup-test-data.service.js and storage-cleanup cron.';
