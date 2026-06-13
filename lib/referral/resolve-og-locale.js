/**
 * Stage 132.2 — OG / crawler locale (cookie → Accept-Language → RU host default).
 */
import { cookies, headers } from 'next/headers'
import { normalizeUiLocaleCode, DEFAULT_UI_LOCALE } from '@/lib/i18n/locale-resolver'

/**
 * @returns {Promise<'ru'|'en'|'zh'|'th'>}
 */
export async function resolveOgLocale() {
  const jar = cookies()
  const cookieLang = jar.get('gostaylo_language')?.value
  if (cookieLang) return normalizeUiLocaleCode(cookieLang)

  const h = headers()
  const accept = h.get('accept-language') || ''
  const primary = accept.split(',')[0]?.split('-')[0]?.trim().toLowerCase()
  if (primary) return normalizeUiLocaleCode(primary)

  const host = String(h.get('x-forwarded-host') || h.get('host') || '').toLowerCase()
  if (host.includes('airento.ru') || host.endsWith('.ru')) return 'ru'

  return normalizeUiLocaleCode(DEFAULT_UI_LOCALE)
}

export default { resolveOgLocale }
