/**
 * Преобразование публичных URL Supabase Storage в same-origin пути /_storage/...
 * чтобы браузер не обращался к *.supabase.co напрямую (rewrites в next.config.js).
 */

function getBase() {
  return typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
    : ''
}

/**
 * @param {string | null | undefined} url
 * @returns {string | null | undefined}
 */
export function toStorageProxyUrl(url) {
  if (!url || typeof url !== 'string') return url
  if (url.startsWith('/_storage/') || url.startsWith('/placeholder')) return url
  if (url.startsWith('data:') || url.startsWith('blob:')) return url

  const base = getBase()
  if (!base) return url

  const publicPrefix = `${base}/storage/v1/object/public/`
  if (url.startsWith(publicPrefix)) {
    return `/_storage/${url.slice(publicPrefix.length)}`
  }

  // Подписанные URL оставляем как есть (нельзя простым rewrite)
  if (url.includes('/storage/v1/object/sign/')) return url

  return url
}

/**
 * @param {string[]} urls
 */
export function mapStorageUrlsToProxy(urls) {
  if (!Array.isArray(urls)) return urls
  return urls.map(toStorageProxyUrl)
}
