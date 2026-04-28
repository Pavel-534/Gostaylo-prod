/**
 * Единый отображаемый формат дат/времени реферальной программы (Stage 73.6): **DD.MM.YYYY** и при необходимости время.
 * Использовать в UI рефералки, PDF-визитках и связанных отчётах.
 */

/**
 * @param {string | number | Date | null | undefined} isoOrDate
 * @returns {string}
 */
export function formatReferralDateDdMmYyyy(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * DD.MM.YYYY для календарного дня в заданной IANA TZ (серверные ответы API / SSOT периода).
 * @param {string | number | Date | null | undefined} isoOrDate
 * @param {string} ianaTimeZone
 * @returns {string}
 */
export function formatReferralDateDdMmYyyyInTimeZone(isoOrDate, ianaTimeZone) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  const tz = String(ianaTimeZone || 'UTC').trim() || 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(d);
    const day = parts.find((p) => p.type === 'day')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const year = parts.find((p) => p.type === 'year')?.value;
    if (!day || !month || !year) return formatReferralDateDdMmYyyy(d);
    return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
  } catch {
    return formatReferralDateDdMmYyyy(d);
  }
}

/**
 * Дата и время в локали браузера, шаблон DD.MM.YYYY HH:mm (24h).
 * @param {string | number | Date | null | undefined} isoOrDate
 * @returns {string}
 */
export function formatReferralDateTimeDdMmYyyyHm(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
