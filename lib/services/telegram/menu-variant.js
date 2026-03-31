/**
 * Роль из profiles → вариант главного меню бота (partner = полное, renter/guest = короткое).
 */
import { telegramEnv } from './env.js'

const PARTNER_MENU_ROLES = new Set(['PARTNER', 'ADMIN'])

/**
 * @param {string | null | undefined} role
 * @returns {'partner' | 'renter' | 'guest'}
 */
export function menuVariantFromRole(role) {
  const r = String(role || '').toUpperCase()
  if (PARTNER_MENU_ROLES.has(r)) return 'partner'
  if (r === 'RENTER') return 'renter'
  return 'guest'
}

/**
 * @param {string | number} chatId — Telegram chat.id
 * @returns {Promise<'partner' | 'renter' | 'guest'>}
 */
export async function resolveMenuVariantForTelegramChat(chatId) {
  const { supabaseUrl, serviceKey } = telegramEnv()
  if (!supabaseUrl || !serviceKey) return 'guest'
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?telegram_id=eq.${encodeURIComponent(String(chatId))}&select=role`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    )
    const rows = await res.json()
    const role = Array.isArray(rows) ? rows[0]?.role : null
    if (role == null) return 'guest'
    return menuVariantFromRole(role)
  } catch (e) {
    console.error('[menu-variant] resolveMenuVariantForTelegramChat', e)
    return 'guest'
  }
}
