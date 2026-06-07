/**
 * CJS bridge for next.config.js / Node scripts.
 * Logic MUST match `lib/site-url.js` (ESM SSOT).
 */

const DEFAULT_CANONICAL_ORIGIN = 'https://airento.ru'

/** Apex hostnames (без www). Legacy gostaylo.* — редиректы и старые ссылки в чате. */
const KNOWN_SITE_HOSTS = [
  'airento.ru',
  'airento.com',
  'gostaylo.ru',
  'gostaylo.com',
]

function buildSiteImageHosts() {
  const hosts = new Set()
  for (const apex of KNOWN_SITE_HOSTS) {
    hosts.add(apex)
    hosts.add(`www.${apex}`)
  }
  return [...hosts]
}

function getPublicSiteUrlFromEnv() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    DEFAULT_CANONICAL_ORIGIN
  return String(raw).trim().replace(/\/$/, '')
}

function isKnownSiteHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return false
  const noWww = hostname.toLowerCase().trim().replace(/^www\./, '')
  if (KNOWN_SITE_HOSTS.includes(noWww)) return true
  return noWww.endsWith('.vercel.app')
}

module.exports = {
  DEFAULT_CANONICAL_ORIGIN,
  KNOWN_SITE_HOSTS,
  SITE_IMAGE_HOSTS: buildSiteImageHosts(),
  getPublicSiteUrlFromEnv,
  isKnownSiteHostname,
}
