-- Спор: события таймлайна + resolution_reason (вердикт админа для сторон и уведомлений).

ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS resolution_reason TEXT NULL;

COMMENT ON COLUMN public.disputes.resolution_reason IS 'Текст вердикта при закрытии дела (дублируется в уведомления гостю/партнёру).';

CREATE TABLE IF NOT EXISTS public.dispute_events (
  id TEXT PRIMARY KEY DEFAULT ('dse-' || replace(gen_random_uuid()::text, '-', '')),
  dispute_id TEXT NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT NULL,
  to_status TEXT NULL,
  actor_id TEXT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT NULL,
  reason TEXT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_events_dispute_created ON public.dispute_events(dispute_id, created_at);

COMMENT ON TABLE public.dispute_events IS 'Журнал переходов и действий по кейсу (админка timeline).';

-- Однократный бэкфилл «открыт кейс» для споров без строк в журнале (идемпотентность по absence of any row).
INSERT INTO public.dispute_events (id, dispute_id, event_type, from_status, to_status, actor_id, actor_role, reason, metadata, created_at)
SELECT
  'dse-bf-' || substr(md5(d.id::text || d.created_at::text), 1, 40),
  d.id,
  'DISPUTE_OPENED',
  NULL,
  d.status,
  d.opened_by,
  CASE
    WHEN d.opened_by = b.renter_id THEN 'RENTER'
    WHEN d.opened_by = b.partner_id THEN 'PARTNER'
    ELSE 'USER'
  END,
  COALESCE(NULLIF(trim(d.description), ''), ''),
  jsonb_build_object('source', 'migration_044_backfill'),
  d.created_at
FROM public.disputes d
JOIN public.bookings b ON b.id = d.booking_id
WHERE NOT EXISTS (SELECT 1 FROM public.dispute_events e WHERE e.dispute_id = d.id);
