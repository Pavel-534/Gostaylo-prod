/**
 * Публичный origin для ссылок в письмах, push, server-side API callbacks.
 * Задайте NEXT_PUBLIC_APP_URL или NEXT_PUBLIC_BASE_URL под канонический домен.
 * Не используйте это для путей к JS/CSS — бандлы Next всегда относительные (/ _next/...).
 *
 * Для sitemap/robots (Metadata Route): на сервере используйте `getRequestSiteUrl` из
 * `lib/server-site-url.js` (Host / X-Forwarded-*). Если контекста запроса нет — fallback
 * через `getPublicSiteUrl()` из этого файла.
 */

export function getPublicSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://gostaylo.ru'
  return raw.replace(/\/$/, '')
}

/**
 * Короткое имя сайта для PDF, premium-email шапки и плейсхолдеров пушей (Stage 47.2 + 49.0).
 * Приоритет: NEXT_PUBLIC_SITE_NAME | SITE_DISPLAY_NAME (trim). Если не задано — нейтрально **Platform**
 * (без hostname из getPublicSiteUrl — единый SSOT для white-label).
 */
export function getSiteDisplayName() {
  const explicit = process.env.NEXT_PUBLIC_SITE_NAME || process.env.SITE_DISPLAY_NAME
  if (explicit && String(explicit).trim()) return String(explicit).trim()
  return 'Platform'
}

/**
 * Канонический URL вебхука для Telegram setWebhook.
 * Путь заканчивается на `/` — совпадает с `trailingSlash: true` в Next.js, чтобы не было 307 при POST.
 * 
 * ВАЖНО: Cloudflare редиректит www.gostaylo.ru -> gostaylo.ru (307),
 * поэтому для Telegram используем домен БЕЗ www, иначе webhook получит 307.
 */
export function getTelegramWebhookUrl() {
  // Убираем www из URL, так как Cloudflare редиректит www -> non-www
  const siteUrl = getPublicSiteUrl().replace('://www.', '://');
  return `${siteUrl}/api/webhooks/telegram/`
}

/**
 * Опциональный префикс локали в URL (когда появится роутинг /en/...).
 * NEXT_PUBLIC_TELEGRAM_LOCALE_IN_URL=true — для en добавляется /en перед путём.
 */
function useLocalePrefixInUrl() {
  const v = process.env.NEXT_PUBLIC_TELEGRAM_LOCALE_IN_URL
  return v === 'true' || v === '1'
}

/**
 * @param {'ru' | 'en'} lang — язык UI бота
 * @param {string} pathname — путь, напр. /partner/listings
 */
export function buildLocalizedSitePath(lang, pathname) {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (useLocalePrefixInUrl() && lang === 'en') {
    return `/en${p}`
  }
  return p
}

export function buildLocalizedSiteUrl(lang, pathname) {
  return `${getPublicSiteUrl()}${buildLocalizedSitePath(lang, pathname)}`
}
