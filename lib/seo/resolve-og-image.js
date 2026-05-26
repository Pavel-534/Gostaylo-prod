/**
 * Stage 117.0 — SSOT: Open Graph image (fallback + absolute URL).
 */

/** Канонический fallback (public/og-image.jpg копируется с hero при сборке/деплое). */
export const DEFAULT_OG_IMAGE_PATH = '/og-image.jpg'

export const OG_IMAGE_FALLBACK_PATHS = ['/og-image.jpg', '/og-image.png', DEFAULT_OG_IMAGE_PATH]

/**
 * @param {string | null | undefined} imagePath
 * @param {string} [baseUrl]
 * @returns {string}
 */
export function resolveOgImageUrl(imagePath, baseUrl) {
  const base = String(baseUrl || '').replace(/\/$/, '')
  const raw = String(imagePath || '').trim()
  if (raw) {
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
    return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`
  }
  return `${base}${DEFAULT_OG_IMAGE_PATH}`
}

/**
 * @param {string | null | undefined} imagePath
 * @param {string} baseUrl
 * @param {string} [alt]
 */
export function buildOgImageMetadata(imagePath, baseUrl, alt = '') {
  const url = resolveOgImageUrl(imagePath, baseUrl)
  return [
    {
      url,
      width: 1200,
      height: 630,
      alt: alt || 'GoStayLo',
    },
  ]
}
