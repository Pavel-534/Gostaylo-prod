/**
 * Stage 193.1 — platform (admin) iCal re-fetch throttle SSOT.
 * Physical wake-up remains cron-job.org (~30 min) → `/api/cron/ical-sync`.
 * Admin `system_settings.ical_sync_settings.frequency` cannot run faster than that heartbeat.
 */

export const ICAL_PLATFORM_FREQUENCY_DEFAULT = '1h'

/** @type {Record<string, number>} */
const FREQUENCY_TO_MS = {
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
}

/**
 * @param {unknown} frequency — e.g. `30m`, `1h`
 * @returns {number} milliseconds
 */
export function icalFrequencyToMs(frequency) {
  const key = String(frequency || '').trim()
  return FREQUENCY_TO_MS[key] || FREQUENCY_TO_MS[ICAL_PLATFORM_FREQUENCY_DEFAULT]
}

/**
 * @param {unknown} settingsValue — `system_settings.ical_sync_settings.value`
 * @returns {{ frequency: string, enabled: boolean, intervalMs: number }}
 */
export function resolveIcalPlatformSyncPolicy(settingsValue) {
  const raw = settingsValue && typeof settingsValue === 'object' ? settingsValue : {}
  const frequency =
    typeof raw.frequency === 'string' && raw.frequency.trim()
      ? raw.frequency.trim()
      : ICAL_PLATFORM_FREQUENCY_DEFAULT
  const enabled = raw.enabled !== false
  return {
    frequency,
    enabled,
    intervalMs: icalFrequencyToMs(frequency),
  }
}
