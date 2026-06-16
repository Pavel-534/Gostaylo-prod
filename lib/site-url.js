/**
 * SSOT публичного origin, multi-domain whitelist и email-домена бренда.
 *
 * Env (канонический origin): NEXT_PUBLIC_APP_URL | NEXT_PUBLIC_BASE_URL
 * Имя бренда: NEXT_PUBLIC_SITE_NAME | SITE_DISPLAY_NAME → getSiteDisplayName()
 *
 * Request-scoped origin (Host / X-Forwarded-*): lib/server-site-url.js → getRequestSiteUrl()
 * CJS bridge (next.config): lib/site-url.cjs
 */

export const DEFAULT_CANONICAL_ORIGIN = 'https://airento.ru'

/** Apex hostnames (без www). Legacy gostaylo.* — редиректы и старые абсолютные ссылки. */
export const KNOWN_SITE_HOSTS = [
  'airento.ru',
  'airento.com',
  'gostaylo.ru',
  'gostaylo.com',
]

/** Next/Image + CSP: www + apex для всех KNOWN_SITE_HOSTS. */
export const SITE_IMAGE_HOSTS = (() => {
  const hosts = new Set()
  for (const apex of KNOWN_SITE_HOSTS) {
    hosts.add(apex)
    hosts.add(`www.${apex}`)
  }
  return [...hosts]
})()

function normalizeOrigin(raw) {
  if (!raw || !String(raw).trim()) return ''
  return String(raw).trim().replace(/\/$/, '')
}

/**
 * @param {string | null | undefined} hostname
 */
export function isKnownSiteHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return false
  const noWww = hostname.toLowerCase().trim().replace(/^www\./, '')
  if (KNOWN_SITE_HOSTS.includes(noWww)) return true
  return noWww.endsWith('.vercel.app')
}

/**
 * Канонический origin для писем, push, server-side ссылок без контекста запроса.
 */
export function getPublicSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    DEFAULT_CANONICAL_ORIGIN
  return normalizeOrigin(raw)
}

/**
 * Apex-домен для UID iCal, fallback From и т.п.
 */
export function getSiteEmailDomain() {
  try {
    return new URL(getPublicSiteUrl()).hostname.replace(/^www\./i, '')
  } catch {
    return 'airento.ru'
  }
}

/**
 * @param {'booking' | 'noreply' | string} mailbox
 */
export function buildDefaultFromAddress(mailbox = 'booking') {
  const name = getSiteDisplayName()
  const local = String(mailbox || 'booking').trim().replace(/@.*/, '') || 'booking'
  return `${name} <${local}@${getSiteEmailDomain()}>`
}

/**
 * Короткое имя сайта для PDF, email шапки и плейсхолдеров пушей.
 * CJS bridge: lib/site-brand.cjs
 */
export function getSiteDisplayName() {
  const explicit = process.env.NEXT_PUBLIC_SITE_NAME || process.env.SITE_DISPLAY_NAME
  if (explicit && String(explicit).trim()) return String(explicit).trim()
  return 'Platform'
}

/**
 * Slug for download filenames (`invite-*.png`, `statement-*.pdf`, …).
 */
export function getSiteBrandSlug() {
  const name = getSiteDisplayName()
  if (name === 'Platform') return 'platform'
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'platform'
}

/**
 * Public partner/support Telegram (human channel, not BotFather bot).
 * Env: NEXT_PUBLIC_SUPPORT_TELEGRAM (@handle or full t.me URL).
 * @returns {string | null}
 */
export function getSupportTelegramUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM ||
    process.env.NEXT_PUBLIC_TELEGRAM_SUPPORT_URL ||
    ''
  const v = String(raw).trim()
  if (!v) return null
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  const handle = v.replace(/^@/, '').trim()
  return handle ? `https://t.me/${handle}` : null
}

/**
 * Telegram setWebhook — origin без www (избегаем 307 apex↔www на прокси).
 */
export function getTelegramWebhookUrl() {
  const siteUrl = getPublicSiteUrl().replace('://www.', '://')
  return `${siteUrl}/api/webhooks/telegram/`
}

function isTelegramLocalePrefixInUrlEnabled() {
  const v = process.env.NEXT_PUBLIC_TELEGRAM_LOCALE_IN_URL
  return v === 'true' || v === '1'
}

/**
 * @param {'ru' | 'en'} lang
 * @param {string} pathname
 */
export function buildLocalizedSitePath(lang, pathname) {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (isTelegramLocalePrefixInUrlEnabled() && lang === 'en') {
    return `/en${p}`
  }
  return p
}

export function buildLocalizedSiteUrl(lang, pathname) {
  return `${getPublicSiteUrl()}${buildLocalizedSitePath(lang, pathname)}`
}
