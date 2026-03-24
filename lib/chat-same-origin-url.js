/**
 * Приводит абсолютные URL Gostaylo к путям текущего origin (.ru / .com / preview),
 * чтобы ссылки из чата не уводили на другой домен и не теряли куку сессии.
 */

export function toRelativeSiteUrl(href) {
  if (!href || typeof href !== 'string') return href
  try {
    const u = new URL(href.trim())
    const h = u.hostname.toLowerCase()
    const noWww = h.replace(/^www\./, '')
    const isOur =
      noWww === 'gostaylo.ru' ||
      noWww === 'gostaylo.com' ||
      noWww.endsWith('.vercel.app')
    if (isOur) {
      const path = `${u.pathname}${u.search}${u.hash}`
      return path && path !== '' ? path : '/'
    }
  } catch {
    /* relative or invalid */
  }
  return href
}
