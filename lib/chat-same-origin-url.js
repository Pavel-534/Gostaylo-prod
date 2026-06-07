/**
 * Абсолютные URL бренда → пути текущего origin (multi-domain SSOT),
 * чтобы ссылки из чата не уводили на другой домен и не теряли куку сессии.
 */

import { isKnownSiteHostname } from '@/lib/site-url'

export function toRelativeSiteUrl(href) {
  if (!href || typeof href !== 'string') return href
  try {
    const u = new URL(href.trim())
    const noWww = u.hostname.toLowerCase().replace(/^www\./, '')
    if (isKnownSiteHostname(noWww)) {
      const path = `${u.pathname}${u.search}${u.hash}`
      return path && path !== '' ? path : '/'
    }
  } catch {
    /* relative or invalid */
  }
  return href
}
