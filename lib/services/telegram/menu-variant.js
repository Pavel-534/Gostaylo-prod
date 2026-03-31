/**
 * Роль из profiles → вариант главного меню бота.
 * Партнёр может включить «режим гостя» (notification_preferences.telegram_guest_menu).
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
 * Ключи клавиатуры (см. inline-menu.js).
 * - partner — бизнес-меню
 * - partner_guest — ссылки как у рентера + выход в режим партнёра
 * - renter / guest — поиск + чаты
 * @typedef {'partner' | 'partner_guest' | 'renter' | 'guest'} TelegramMenuKeyboardVariant
 */

/**
 * @param {string | number} chatId — Telegram chat.id
 * @returns {Promise<TelegramMenuKeyboardVariant>}
 */
export async function resolveMenuVariantForTelegramChat(chatId) {
  const { supabaseUrl, serviceKey } = telegramEnv()
  if (!supabaseUrl || !serviceKey) return 'guest'
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?telegram_id=eq.${encodeURIComponent(String(chatId))}&select=role,notification_preferences`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    )
    const rows = await res.json()
    const row = Array.isArray(rows) ? rows[0] : null
    const role = row?.role
    if (role == null) return 'guest'

    const base = menuVariantFromRole(role)
    const prefs = row?.notification_preferences
    const guestMenu =
      prefs && typeof prefs === 'object' && prefs.telegram_guest_menu === true

    if (base === 'partner' && guestMenu) return 'partner_guest'
    if (base === 'partner') return 'partner'
    if (base === 'renter') return 'renter'
    return 'guest'
  } catch (e) {
    console.error('[menu-variant] resolveMenuVariantForTelegramChat', e)
    return 'guest'
  }
}

/**
 * Для текстов /start /help: логическая роль без учёта гостевого меню.
 * @returns {Promise<'partner' | 'renter' | 'guest'>}
 */
export async function resolveContentMenuVariantForTelegramChat(chatId) {
  const v = await resolveMenuVariantForTelegramChat(chatId)
  if (v === 'partner_guest') return 'partner'
  return v
}
