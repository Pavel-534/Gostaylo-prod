/**
 * Stage 143 — SSOT locale for outbound notifications (push / email / TG handlers).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { resolveUserLocale, normalizeUiLocaleCode } from '@/lib/i18n/locale-resolver.js'
import { normalizeEmailLang } from '@/lib/email/booking-email-i18n.js'

export { resolveUserLocale as resolveNotifyLocale }

/**
 * @param {{ preferred_language?: string | null, language?: string | null } | null | undefined} profile
 */
export function resolveNotifyLocaleFromProfile(profile) {
  return resolveUserLocale(profile)
}

/**
 * Guest/renter locale: profile → booking.metadata.ui_locale → DB lookup → default.
 * @param {{ renter_id?: string, metadata?: { ui_locale?: string } } | null | undefined} booking
 * @param {{ preferred_language?: string | null, language?: string | null } | null | undefined} guestProfile
 */
export async function resolveGuestNotifyLocale(booking, guestProfile) {
  if (guestProfile && typeof guestProfile === 'object') {
    return normalizeEmailLang(resolveUserLocale(guestProfile))
  }
  const snap = booking?.metadata?.ui_locale
  if (snap) return normalizeEmailLang(normalizeUiLocaleCode(snap))

  const renterId = booking?.renter_id ? String(booking.renter_id) : ''
  if (renterId && supabaseAdmin?.from) {
    try {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('preferred_language, language')
        .eq('id', renterId)
        .maybeSingle()
      if (prof) return normalizeEmailLang(resolveUserLocale(prof))
    } catch {
      /* ignore */
    }
  }
  return 'ru'
}

/**
 * For inline copy maps that only have ru/en today — zh/th fall back to en (until full keys).
 * @param {string} lang
 */
export function notifyCopyLang(lang) {
  const code = normalizeUiLocaleCode(lang)
  if (code === 'zh' || code === 'th') return 'en'
  return code
}
