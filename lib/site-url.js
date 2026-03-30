/**
 * Публичный origin для ссылок в письмах, push, server-side API callbacks.
 * Задайте NEXT_PUBLIC_APP_URL или NEXT_PUBLIC_BASE_URL под канонический домен.
 * Не используйте это для путей к JS/CSS — бандлы Next всегда относительные (/ _next/...).
 */

export function getPublicSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://gostaylo.ru'
  return raw.replace(/\/$/, '')
}

/**
 * Канонический URL вебхука для Telegram setWebhook.
 * Путь заканчивается на `/` — совпадает с `trailingSlash: true` в Next.js, чтобы не было 307 при POST.
 */
export function getTelegramWebhookUrl() {
  return `${getPublicSiteUrl()}/api/webhooks/telegram/`
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
