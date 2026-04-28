/**
 * SSOT: календарь реферальной статистики (месяц/год/sparklines) в UI и GET /api/v2/referral/me.
 * Не путать с таймзоной листинга (география бронирований) — см. ARCHITECTURAL_DECISIONS.md § Calendar & Timezones.
 */

import { listingYmdAtStartOfDayIso } from '@/lib/listing-date';
import { currentYearMonthKeyInTimeZone } from '@/lib/referral/tz-year-month';

/** Проверка IANA TZ (доступна клиенту и серверу). */
export function isValidIanaTimeZone(value) {
  const tz = String(value || '').trim();
  if (!tz) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Приоритет: `profiles.iana_timezone` (IANA) → при пустом/невалидном **`UTC`**.
 * @param {{ iana_timezone?: string | null } | null | undefined} profile
 * @returns {string}
 */
export function resolveReferralStatsTimeZone(profile) {
  const raw = String(profile?.iana_timezone ?? '').trim();
  if (raw && isValidIanaTimeZone(raw)) return raw;
  return 'UTC';
}

/**
 * Начало текущего календарного месяца в TZ статистики реферера (UTC ISO), для лимита регистраций и согласованности с API.
 * @param {{ iana_timezone?: string | null } | null | undefined} profile
 * @param {Date} [refDate]
 * @returns {string}
 */
export function referralStatsCalendarMonthStartUtcIso(profile, refDate = new Date()) {
  const tz = resolveReferralStatsTimeZone(profile);
  const ymKey = currentYearMonthKeyInTimeZone(refDate, tz);
  if (!ymKey || ymKey.length < 7) {
    const d = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 1, 0, 0, 0, 0));
    return d.toISOString();
  }
  const [y, m] = ymKey.split('-');
  const iso = listingYmdAtStartOfDayIso(`${y}-${String(m).padStart(2, '0')}-01`, tz);
  return iso || new Date(Date.UTC(Number(y), Number(m) - 1, 1, 0, 0, 0, 0)).toISOString();
}
