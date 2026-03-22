/**
 * Канонический origin страницы на сервере (по Host / X-Forwarded-*).
 * Не использовать для статики Next — только для metadata, OG, canonical.
 * См. lib/site-url.js (getPublicSiteUrl) для ссылок в письмах и push.
 */
import { headers } from 'next/headers'

export async function getRequestSiteUrl() {
  const headersList = await headers()
  const rawHost = headersList.get('x-forwarded-host') || headersList.get('host')
  const protocol = (headersList.get('x-forwarded-proto') || 'https').split(',')[0].trim()

  if (rawHost) {
    const host = rawHost.split(',')[0].trim()
    return `${protocol}://${host}`.replace(/\/$/, '')
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://gostaylo.ru'
  ).replace(/\/$/, '')
}
