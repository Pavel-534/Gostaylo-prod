/**
 * Подмена URL Unsplash на same-origin прокси (Vercel тянет картинку, пользователь — с gostaylo.ru).
 * См. GET /api/v2/images/proxy
 */
const UNSPLASH_HOST = 'images.unsplash.com'

export function isUnsplashImageUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('https://')) return false
  try {
    return new URL(url).hostname === UNSPLASH_HOST
  } catch {
    return false
  }
}

/**
 * @param {string|null|undefined} url
 * @returns {string}
 */
export function proxifyUnsplashUrl(url) {
  if (!url || typeof url !== 'string') return url || ''
  if (!isUnsplashImageUrl(url)) return url
  return `/api/v2/images/proxy?url=${encodeURIComponent(url)}`
}
