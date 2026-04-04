/**
 * Whether an iCal sync source should run (cron, admin, partner /api/ical/sync).
 * Treats missing flags as ON; only explicit false disables.
 * Supports both `enabled` (partner UI) and `active` (legacy / cron).
 */
export function isIcalSyncSourceEnabled(source) {
  if (source == null || typeof source.url !== 'string' || !source.url.trim()) {
    return false;
  }
  if (source.enabled === false) return false;
  if (source.active === false) return false;
  return true;
}
