/**
 * Канонический origin страницы на сервере (по Host / X-Forwarded-*).
 * Не использовать для статики Next — только metadata, OG, canonical.
 * Fallback без доверенного Host → getPublicSiteUrl() из lib/site-url.js.
 */
import { headers } from 'next/headers'
import { getPublicSiteUrl, isKnownSiteHostname } from '@/lib/site-url'

export async function getRequestSiteUrl() {
  const headersList = await headers()
  const rawHost = headersList.get('x-forwarded-host') || headersList.get('host')
  const protocol = (headersList.get('x-forwarded-proto') || 'https').split(',')[0].trim()

  if (rawHost) {
    const host = rawHost.split(',')[0].trim().toLowerCase()
    const noWww = host.replace(/^www\./, '')
    if (isKnownSiteHostname(noWww)) {
      return `${protocol}://${host}`.replace(/\/$/, '')
    }
  }

  return getPublicSiteUrl()
}
