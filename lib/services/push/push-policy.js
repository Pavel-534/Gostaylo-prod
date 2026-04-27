/**
 * Push eligibility — who receives what and when (Stage 70.6).
 * Quiet hours / partner windows: `push-quiet-policy.js` (re-exported here for one import surface).
 */

import { supabaseAdmin } from '@/lib/supabase'
export {
  WEB_ACTIVE_WINDOW_MS,
  PREMIUM_CHAT_PUSH_DELAY_MS,
  FCM_INSTANT_PUSH_DEBUG,
  resolveSilentForPushDelivery,
  isWebSurface,
  isWebActiveRecently,
} from '@/lib/services/push/push-quiet-policy.js'

/** false = do not send (read or missing row). */
export async function shouldStillSendNewMessagePush(messageId) {
  if (!messageId) return true
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('is_read')
    .eq('id', messageId)
    .maybeSingle()
  if (error || !data) return false
  return data.is_read !== true
}

/**
 * Staff do not receive NEW_MESSAGE pushes (inbox is desktop-first).
 * @param {{ role?: string|null }} profile
 * @param {string} templateKey
 */
export function shouldSkipPushForStaffChat(profile, templateKey) {
  if (templateKey !== 'NEW_MESSAGE') return false
  const role = String(profile?.role || '').toUpperCase()
  return role === 'ADMIN' || role === 'MODERATOR'
}

/**
 * Reserved: global opt-out / ban — extend when `profiles` gains explicit push flags.
 * @returns {Promise<boolean>} true = skip all pushes for user
 */
export async function isUserPushGloballyBlocked(_userId) {
  return false
}
