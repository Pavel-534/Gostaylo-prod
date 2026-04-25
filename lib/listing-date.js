/**
 * Listing calendar dates — single reference timezone for YYYY-MM-DD everywhere.
 * Avoids mixing Date#setDate (process-local) with toISOString() (UTC).
 *
 * Env: LISTING_DATE_TZ or NEXT_PUBLIC_LISTING_DATE_TZ (IANA), default Asia/Bangkok.
 */

export function getListingDateTimeZone() {
  return (
    process.env.LISTING_DATE_TZ ||
    process.env.NEXT_PUBLIC_LISTING_DATE_TZ ||
    'Asia/Bangkok'
  );
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeTimeZoneOrDefault(timeZone) {
  const candidate = String(timeZone || '').trim()
  if (!candidate) return getListingDateTimeZone()
  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return getListingDateTimeZone()
  }
}

/**
 * @param {string|Date|number|null|undefined} input
 * @param {string} [timeZone]
 * @returns {string|null} YYYY-MM-DD in listing TZ, or null
 */
export function toListingDate(input, timeZone) {
  const tz = normalizeTimeZoneOrDefault(timeZone)
  if (input == null || input === '') return null;
  if (typeof input === 'string') {
    const s = input.trim().slice(0, 10);
    if (YMD_RE.test(s)) return s;
    const t = Date.parse(input);
    if (Number.isNaN(t)) return null;
    return formatYmdInTimeZone(new Date(t), tz);
  }
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return formatYmdInTimeZone(input, tz);
  }
  if (typeof input === 'number' && Number.isFinite(input)) {
    return formatYmdInTimeZone(new Date(input), tz);
  }
  return null;
}

function formatYmdInTimeZone(d, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

/**
 * Add signed calendar days to YYYY-MM-DD using UTC calendar arithmetic (no DST drift).
 * @param {string} isoDate YYYY-MM-DD
 * @param {number} delta
 * @returns {string}
 */
export function addListingDays(isoDate, delta) {
  const s = String(isoDate).slice(0, 10);
  if (!YMD_RE.test(s)) return s;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(delta)));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Today's calendar date in listing timezone.
 * @param {string} [timeZone]
 * @returns {string} YYYY-MM-DD
 */
export function listingDateToday(timeZone) {
  return toListingDate(new Date(), timeZone);
}

function parseOffsetMinutes(offsetText) {
  const m = String(offsetText || '').match(/([+-])(\d{1,2})(?::?(\d{2}))?/)
  if (!m) return null
  const sign = m[1] === '-' ? -1 : 1
  const hh = parseInt(m[2], 10) || 0
  const mm = parseInt(m[3] || '0', 10) || 0
  return sign * (hh * 60 + mm)
}

function getOffsetMinutesAtUtcMs(utcMs, tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(utcMs))
    const label = parts.find((p) => p.type === 'timeZoneName')?.value || ''
    const parsed = parseOffsetMinutes(label)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

/**
 * Start of a listing-calendar day (00:00 in LISTING_DATE_TZ) as ISO UTC for `bookings.check_in` / `check_out` TIMESTAMPTZ.
 * Matches migration PR-#4 `(date || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Bangkok'` for Bangkok.
 * @param {string} ymd YYYY-MM-DD
 * @param {string} [timeZone]
 * @returns {string|null}
 */
export function listingYmdAtStartOfDayIso(ymd, timeZone) {
  const raw = String(ymd || '').slice(0, 10);
  if (!YMD_RE.test(raw)) return null;
  const tz = normalizeTimeZoneOrDefault(timeZone);
  const [y, m, d] = raw.split('-').map((x) => parseInt(x, 10));
  let utcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const offset0 = getOffsetMinutesAtUtcMs(utcMs, tz);
  utcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offset0 * 60 * 1000;
  const offset1 = getOffsetMinutesAtUtcMs(utcMs, tz);
  if (offset1 !== offset0) {
    utcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offset1 * 60 * 1000;
  }
  return new Date(utcMs).toISOString();
}

/**
 * Частая ошибка: в БД попадает полночь UTC (`…T00:00:00.000Z`) вместо «начала календарного дня» в зоне объекта —
 * в Asia/Bangkok это отображается как 07:00. Переводим якорь в 00:00 по LISTING_DATE_TZ для этой календарной даты.
 * Не трогаем реальные снимки времени (не UTC‑полночь).
 * @param {string|Date|number|null|undefined} iso
 * @param {string} [timeZone]
 * @returns {string|Date|number|null|undefined}
 */
export function anchorUtcMidnightToListingDayStartIso(iso, timeZone) {
  if (iso == null || iso === '') return iso;
  const s = String(iso).trim();
  const utcMidnight =
    /T00:00:00(\.\d{1,3})?Z$/i.test(s) ||
    /T00:00:00(\.\d{1,3})?\+00:00$/i.test(s) ||
    /T00:00:00(\.\d{1,3})?-00:00$/i.test(s);
  if (!utcMidnight) return iso;
  const ymd = toListingDate(iso, timeZone);
  if (!ymd) return iso;
  return listingYmdAtStartOfDayIso(ymd, timeZone) || iso;
}

/**
 * For DB writes: YYYY-MM-DD → listing start-of-day ISO; full timestamps pass through as ISO.
 * @param {string|Date|number|null|undefined} value
 * @param {string} [timeZone]
 * @returns {string|null}
 */
export function normalizeBookingInstantForDb(value, timeZone) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (YMD_RE.test(s.slice(0, 10)) && s.length <= 10) {
    return listingYmdAtStartOfDayIso(s.slice(0, 10), timeZone);
  }
  const t = typeof value === 'number' ? value : Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}
