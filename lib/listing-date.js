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

/**
 * @param {string|Date|number|null|undefined} input
 * @returns {string|null} YYYY-MM-DD in listing TZ, or null
 */
export function toListingDate(input) {
  if (input == null || input === '') return null;
  if (typeof input === 'string') {
    const s = input.trim().slice(0, 10);
    if (YMD_RE.test(s)) return s;
    const t = Date.parse(input);
    if (Number.isNaN(t)) return null;
    return formatYmdInTimeZone(new Date(t), getListingDateTimeZone());
  }
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return formatYmdInTimeZone(input, getListingDateTimeZone());
  }
  if (typeof input === 'number' && Number.isFinite(input)) {
    return formatYmdInTimeZone(new Date(input), getListingDateTimeZone());
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
 * @returns {string} YYYY-MM-DD
 */
export function listingDateToday() {
  return toListingDate(new Date());
}

/**
 * Start of a listing-calendar day (00:00 in LISTING_DATE_TZ) as ISO UTC for `bookings.check_in` / `check_out` TIMESTAMPTZ.
 * Matches migration PR-#4 `(date || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Bangkok'` for Bangkok.
 * @param {string} ymd YYYY-MM-DD
 * @returns {string|null}
 */
export function listingYmdAtStartOfDayIso(ymd) {
  const raw = String(ymd || '').slice(0, 10);
  if (!YMD_RE.test(raw)) return null;
  const tz = getListingDateTimeZone();
  if (tz === 'Asia/Bangkok') {
    const [y, m, d] = raw.split('-').map((x) => parseInt(x, 10));
    const utcMs = Date.UTC(y, m - 1, d, -7, 0, 0);
    return new Date(utcMs).toISOString();
  }
  return `${raw}T00:00:00.000Z`;
}

/**
 * Частая ошибка: в БД попадает полночь UTC (`…T00:00:00.000Z`) вместо «начала календарного дня» в зоне объекта —
 * в Asia/Bangkok это отображается как 07:00. Переводим якорь в 00:00 по LISTING_DATE_TZ для этой календарной даты.
 * Не трогаем реальные снимки времени (не UTC‑полночь).
 * @param {string|Date|number|null|undefined} iso
 * @returns {string|Date|number|null|undefined}
 */
export function anchorUtcMidnightToListingDayStartIso(iso) {
  if (iso == null || iso === '') return iso;
  const s = String(iso).trim();
  const utcMidnight =
    /T00:00:00(\.\d{1,3})?Z$/i.test(s) ||
    /T00:00:00(\.\d{1,3})?\+00:00$/i.test(s) ||
    /T00:00:00(\.\d{1,3})?-00:00$/i.test(s);
  if (!utcMidnight) return iso;
  const ymd = toListingDate(iso);
  if (!ymd) return iso;
  return listingYmdAtStartOfDayIso(ymd) || iso;
}

/**
 * For DB writes: YYYY-MM-DD → listing start-of-day ISO; full timestamps pass through as ISO.
 * @param {string|Date|number|null|undefined} value
 * @returns {string|null}
 */
export function normalizeBookingInstantForDb(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (YMD_RE.test(s.slice(0, 10)) && s.length <= 10) {
    return listingYmdAtStartOfDayIso(s.slice(0, 10));
  }
  const t = typeof value === 'number' ? value : Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}
