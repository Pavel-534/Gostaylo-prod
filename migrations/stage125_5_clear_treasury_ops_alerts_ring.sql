-- Stage 125.5 — treasury ops alerts journal moved to critical_signal_events (append-only).
-- system_settings.general is for global toggles only (emergency pause, manual mode).

UPDATE public.system_settings
SET
  value = value - 'treasury_ops_alerts',
  updated_at = now()
WHERE key = 'general'
  AND value ? 'treasury_ops_alerts';
