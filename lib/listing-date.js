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
