/**
 * Firebase Push Notification Service (FCM) — facade (decomposed)
 * Token repository: push-token-repository.js · Delivery: push-delivery-engine.js
 * Batching: push-batch-manager.js · Quiet policy: push-quiet-handler.js
 */

import { supabaseAdmin } from '@/lib/supabase'
import { resolveUserLocale } from '@/lib/i18n/locale-resolver.js'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import { renterBookingsListPath } from '@/lib/email/booking-routes.js'
import { shouldSkipPushForStaffChat } from '@/lib/services/push/push-policy.js'
import { interpolatePushTemplate } from '@/lib/services/push/push-interpolate.js'
import {
  fetchUserTokens,
  fetchUserPushTokenRows,
  fetchLegacyProfileToken,
  registerToken,
  touchTokenLastSeen,
  removeInvalidToken,
  logInvalidTokenCleanup,
} from '@/lib/services/push/push-token-repository.js'
import {
  sendPush,
  sendSilentBadgeUpdate,
  parseFcmHttpError,
  getFcmAccessToken,
  scheduleBackgroundWork,
  signJwt as deliverySignJwt,
  base64UrlEncode as deliveryBase64UrlEncode,
} from '@/lib/services/push/push-delivery-engine.js'
import {
  pickRecipientTimezone,
} from '@/lib/services/push/push-quiet-handler.js'
import {
  sendNewMessageWithSmartDelivery,
  mergeOrInsertDelayedChatBatch,
  runChatPushBatchLeader,
  resolveRecipientLanguage,
  deliverChatBatchSnapshot,
  runStaleChatPushSweeper,
  scheduleSimpleDelayedPush,
} from '@/lib/services/push/push-batch-manager.js'

export class PushService {
  static async fetchUserTokens(userId) {
    return fetchUserTokens(userId)
  }

  static async fetchUserPushTokenRows(userId) {
    return fetchUserPushTokenRows(userId)
  }

  static parseFcmHttpError(rawText, responseHttpStatus = 0) {
    return parseFcmHttpError(rawText, responseHttpStatus)
  }

  static async deleteInvalidPushToken(fcmToken) {
    return removeInvalidToken(fcmToken)
  }

  static async recordFcmCleanedSignal(tokenSuffix = '') {
    return logInvalidTokenCleanup(tokenSuffix)
  }

  static pickRecipientTimezone(tokenRows) {
    return pickRecipientTimezone(tokenRows)
  }

  static async fetchLegacyProfileToken(userId) {
    return fetchLegacyProfileToken(userId)
  }

  static async scheduleSimpleDelayedPush(_recipientId, tokensDelayed, data, lang) {
    return scheduleSimpleDelayedPush(_recipientId, tokensDelayed, data, lang, {
      scheduleBackgroundWork,
      sendPush: PushService.sendPush.bind(PushService),
      fetchUserPushTokenRows,
    })
  }

  static async mergeOrInsertDelayedChatBatch(recipientId, senderId, tokensDelayed, data, lang) {
    return mergeOrInsertDelayedChatBatch(recipientId, senderId, tokensDelayed, data, lang, {
      scheduleBackgroundWork,
      sendPush: PushService.sendPush.bind(PushService),
      fetchUserPushTokenRows,
      fetchLegacyProfileToken,
    })
  }

  static async runChatPushBatchLeader(recipientId, senderId, lang) {
    return runChatPushBatchLeader(recipientId, senderId, lang, {
      scheduleBackgroundWork,
      sendPush: PushService.sendPush.bind(PushService),
      fetchUserPushTokenRows,
      fetchLegacyProfileToken,
    })
  }

  static async resolveRecipientLanguage(recipientId, fallback = 'ru') {
    return resolveRecipientLanguage(recipientId, fallback)
  }

  static async deliverChatBatchSnapshot({ snap, recipientId, senderId, lang, source = 'leader' }) {
    return deliverChatBatchSnapshot(
      { snap, recipientId, senderId, lang, source },
      {
        sendPush: PushService.sendPush.bind(PushService),
        fetchUserPushTokenRows,
        fetchLegacyProfileToken,
      },
    )
  }

  static async runStaleChatPushSweeper({ staleMinutes = 10, limit = 200 } = {}) {
    return runStaleChatPushSweeper(
      { staleMinutes, limit },
      {
        sendPush: PushService.sendPush.bind(PushService),
        fetchUserPushTokenRows,
        fetchLegacyProfileToken,
      },
    )
  }

  static async getAccessToken() {
    return getFcmAccessToken()
  }

  /** @deprecated Используйте {@link signFirebaseServiceAccountJwt} из `lib/services/push/firebase-oauth.js`. */
  static async signJwt(header, payload, privateKey) {
    return deliverySignJwt(header, payload, privateKey)
  }

  /** @deprecated Используйте {@link firebaseBase64UrlEncode} из `lib/services/push/firebase-oauth.js`. */
  static base64UrlEncode(str) {
    return deliveryBase64UrlEncode(str)
  }

  static async sendPush(fcmToken, templateKey, data = {}, lang = 'ru', logContext = {}) {
    return sendPush(fcmToken, templateKey, data, lang, logContext)
  }

  static async sendToUser(userId, templateKey, data = {}) {
    try {
      console.log(`[PUSH_FLOW] sendToUser start user=${userId} template=${templateKey}`)
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('language, preferred_language, role')
        .eq('id', userId)
        .single()

      if (error || !profile) {
        console.log(`[PUSH_FLOW] sendToUser profile-miss user=${userId} error=${error?.message || 'Profile not found'}`)
        return { success: false, error: error?.message || 'Profile not found' }
      }

      if (shouldSkipPushForStaffChat(profile, templateKey)) {
        console.log(`[PUSH_FLOW] sendToUser skip staff user=${userId}`)
        return { success: true, skipped: true, reason: 'staff_no_chat_push' }
      }

      const lang = resolveUserLocale(profile)
      const legacyToken = await PushService.fetchLegacyProfileToken(userId)

      if (templateKey === 'NEW_MESSAGE' && data.messageId) {
        const result = await this.sendNewMessageWithSmartDelivery(userId, data, lang, legacyToken)
        console.log(
          `[PUSH_FLOW] sendToUser NEW_MESSAGE result user=${userId} success=${Boolean(result?.success)} sent=${Number(result?.sent || 0)} failed=${Number(result?.failed || 0)}`,
        )
        return result
      }

      const tableTokens = await this.fetchUserTokens(userId)
      const allTokens = Array.from(new Set([...tableTokens, ...(legacyToken ? [legacyToken] : [])]))
      if (allTokens.length === 0) {
        console.log(`[FCM] No token for user ${userId}`)
        console.log(`[PUSH_FLOW] sendToUser no-token user=${userId}`)
        return { success: false, error: 'No FCM token' }
      }

      const settled = await Promise.allSettled(
        allTokens.map((token) =>
          this.sendPush(token, templateKey, data, lang, { profileId: userId }),
        ),
      )
      const ok = settled.filter((r) => r.status === 'fulfilled' && r.value?.success).length
      const fail = settled.length - ok
      return {
        success: ok > 0,
        sent: ok,
        failed: fail,
        total: settled.length,
      }
    } catch (error) {
      console.error('[FCM] Send to user error:', error.message)
      console.log(`[PUSH_FLOW] sendToUser exception user=${userId} error=${error?.message || error}`)
      return { success: false, error: error.message }
    }
  }

  static async sendNewMessageWithSmartDelivery(userId, data, lang, legacyToken) {
    return sendNewMessageWithSmartDelivery(userId, data, lang, legacyToken, {
      sendPush: PushService.sendPush.bind(PushService),
      fetchUserPushTokenRows,
      fetchLegacyProfileToken,
      scheduleBackgroundWork,
    })
  }

  static async notifyStaffSupportEscalation(conversationId) {
    const base = getPublicSiteUrl().replace(/\/$/, '')
    const cid = encodeURIComponent(conversationId)
    const link = `${base}/admin/messages/?open=${cid}`

    const { data: staff, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('role', ['ADMIN', 'MODERATOR'])

    if (error || !Array.isArray(staff) || staff.length === 0) {
      console.error('[FCM] notifyStaffSupportEscalation:', error?.message || 'no staff')
      return { success: false, error: error?.message || 'no staff' }
    }

    await Promise.all(
      staff.map((row) =>
        this.sendToUser(row.id, 'SUPPORT_REQUESTED', {
          conversationId,
          link,
        }).catch((e) => console.error('[FCM] support escalate', row.id, e?.message || e)),
      ),
    )

    return { success: true, notified: staff.length }
  }

  static async sendCheckInReminder(bookingId) {
    try {
      const { data: booking, error } = await supabaseAdmin
        .from('bookings')
        .select(
          `
          id,
          guest_name,
          guest_email,
          renter_id,
          listing:listings(id, title)
        `,
        )
        .eq('id', bookingId)
        .single()

      if (error || !booking) {
        return { success: false, error: 'Booking not found' }
      }

      return this.sendToUser(booking.renter_id, 'CHECKIN_REMINDER', {
        listing: booking.listing?.title,
        bookingId: booking.id,
        link: renterBookingsListPath(booking.id),
      })
    } catch (error) {
      console.error('[FCM] Check-in reminder error:', error.message)
      return { success: false, error: error.message }
    }
  }

  static async sendReviewReminder(bookingId) {
    try {
      const { data: booking, error } = await supabaseAdmin
        .from('bookings')
        .select(
          `
          id,
          guest_name,
          renter_id,
          listing:listings(id, title)
        `,
        )
        .eq('id', bookingId)
        .single()

      if (error || !booking) {
        return { success: false, error: 'Booking not found' }
      }

      return this.sendToUser(booking.renter_id, 'REVIEW_REMINDER', {
        listing: booking.listing?.title,
        bookingId: booking.id,
        link: renterBookingsListPath(booking.id),
      })
    } catch (error) {
      console.error('[FCM] Review reminder error:', error.message)
      return { success: false, error: error.message }
    }
  }

  static async registerToken(userId, fcmToken, deviceInfo = null) {
    return registerToken(userId, fcmToken, deviceInfo)
  }

  static async touchTokenLastSeen(userId, fcmToken) {
    return touchTokenLastSeen(userId, fcmToken)
  }

  static async sendSilentBadgeUpdate(fcmToken, unreadCount) {
    return sendSilentBadgeUpdate(fcmToken, unreadCount)
  }

  static async sendSilentBadgeUpdateToUser(userId, unreadCount) {
    let tokens = await this.fetchUserTokens(userId)
    if (tokens.length === 0) {
      const legacyToken = await PushService.fetchLegacyProfileToken(userId)
      if (legacyToken) tokens.push(legacyToken)
    }
    if (tokens.length === 0) return { success: false, error: 'No FCM token' }
    const settled = await Promise.allSettled(
      tokens.map((token) => this.sendSilentBadgeUpdate(token, unreadCount)),
    )
    const ok = settled.filter((r) => r.status === 'fulfilled' && r.value?.success).length
    return {
      success: ok > 0,
      sent: ok,
      failed: settled.length - ok,
      total: settled.length,
      unreadCount,
    }
  }

  static interpolate(template, data) {
    return interpolatePushTemplate(template, data)
  }
}

export default PushService
