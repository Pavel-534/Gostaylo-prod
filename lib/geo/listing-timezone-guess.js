/**
 * Coarse IANA guess from map pin (no external API). Used by listing wizard auto-fill.
 * For production-scale geo-TZ, consider adding a compact polygon library later.
 * @param {number|null|undefined} lat
 * @param {number|null|undefined} lon
 * @returns {string} IANA id or empty string if coords invalid
 */
export function guessIanaTimezoneFromLatLon(lat, lon) {
  const a = Number(lat)
  const b = Number(lon)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return ''
  if (a >= 5.5 && a <= 20.5 && b >= 97 && b <= 105.7) return 'Asia/Bangkok'
  if (a >= -11.5 && a <= 6.5 && b >= 95 && b <= 106) return 'Asia/Jakarta'
  if (a >= 0.8 && a <= 7.8 && b >= 99 && b <= 104.5) return 'Asia/Kuala_Lumpur'
  if (a >= 8 && a <= 23.5 && b >= 102 && b <= 110) return 'Asia/Ho_Chi_Minh'
  if (a >= 1.16 && a <= 1.48 && b >= 103.6 && b <= 104.1) return 'Asia/Singapore'
  if (a >= 45 && a <= 55 && b >= 6 && b <= 24) return 'Europe/Berlin'
  if (a >= 49.5 && a <= 61 && b >= -11 && b <= 2.5) return 'Europe/London'
  if (a >= 24.5 && a <= 49.5 && b >= -125 && b <= -66) return 'America/Los_Angeles'
  return 'Asia/Bangkok'
}
