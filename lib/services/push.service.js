/**
 * Firebase Push Notification Service (FCM) — facade (Stage 70.6)
 * Templates: `lib/services/push/push-templates.js` · Transport: `push-transport.js` · Policy: `push-policy.js`
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url.js'
import { buildFcmTemplateEnvelope } from '@/lib/services/push/fcm-http-delivery.js'
import { parseFcmHttpError } from '@/lib/services/push/fcm-http-delivery.js'
import {
  buildRenderedPushNotification,
  buildPushDataStrings,
  buildSilentBadgeFcmPayload,
} from '@/lib/services/push/push-templates.js'
import {
  TABLE_MISSING_SNIPPET,
  getFcmAccessToken,
  deleteInvalidPushToken,
  recordFcmCleanedSignal,
  deliverFcmNotification,
  scheduleBackgroundWork,
  signJwt as transportSignJwt,
  base64UrlEncode as transportBase64UrlEncode,
} from '@/lib/services/push/push-transport.js'
import {
  shouldStillSendNewMessagePush,
  shouldSkipPushForStaffChat,
  resolveSilentForPushDelivery,
  FCM_INSTANT_PUSH_DEBUG,
  PREMIUM_CHAT_PUSH_DELAY_MS,
} from '@/lib/services/push/push-policy.js'
import { interpolatePushTemplate } from '@/lib/services/push/push-interpolate.js'

function isChatBatchTableMissing(err) {
  const m = String(err?.message || '')
  return m.includes('chat_push_delivery_batch') && m.includes('Could not find the table')
}

export class PushService {
  static async fetchUserTokens(userId) {
    const rows = await this.fetchUserPushTokenRows(userId)
    return Array.from(new Set(rows.map((r) => r.token).filter(Boolean)))
  }

  static async fetchUserPushTokenRows(userId) {
    let selectCols = 'token, last_seen_at, device_info'
    let { data, error } = await supabaseAdmin
      .from('user_push_tokens')
      .select(selectCols)
      .eq('user_id', userId)

    if (
      error &&
      /last_seen_at/i.test(String(error?.message || '')) &&
      /does not exist/i.test(String(error?.message || ''))
    ) {
      selectCols = 'token, device_info'
      ;({ data, error } = await supabaseAdmin
        .from('user_push_tokens')
        .select(selectCols)
        .eq('user_id', userId))
    }

    if (error) {
      if (!String(error?.message || '').includes(TABLE_MISSING_SNIPPET)) {
        console.warn('[FCM] user_push_tokens query error:', error.message)
      }
      return []
    }
    return (Array.isArray(data) ? data : [])
      .map((row) => ({
        token: String(row?.token || '').trim(),
        last_seen_at: row?.last_seen_at ?? null,
        device_info:
          row?.device_info && typeof row.device_info === 'object' ? row.device_info : {},
      }))
      .filter((r) => r.token)
  }

  static parseFcmHttpError(rawText, responseHttpStatus = 0) {
    return parseFcmHttpError(rawText, responseHttpStatus)
  }

  static async deleteInvalidPushToken(fcmToken) {
    return deleteInvalidPushToken(fcmToken)
  }

  static async recordFcmCleanedSignal(tokenSuffix = '') {
    return recordFcmCleanedSignal(tokenSuffix)
  }

  static async shouldStillSendNewMessagePush(messageId) {
    return shouldStillSendNewMessagePush(messageId)
  }

  static pickRecipientTimezone(tokenRows) {
    const rows = Array.isArray(tokenRows) ? tokenRows : []
    for (const r of rows) {
      const z = r?.device_info?.timezone
      if (typeof z === 'string' && z.trim().length > 2) return z.trim()
    }
    return 'UTC'
  }

  static async fetchLegacyProfileToken(userId) {
    if (!userId) return ''
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('fcm_token')
        .eq('id', userId)
        .maybeSingle()
      if (error) {
        const msg = String(error?.message || '')
        if (/column .*fcm_token.* does not exist/i.test(msg)) {
          return ''
        }
        console.warn('[FCM] legacy profiles.fcm_token read:', msg)
        return ''
      }
      return String(data?.fcm_token || '').trim()
    } catch {
      return ''
    }
  }

  static async scheduleSimpleDelayedPush(_recipientId, tokensDelayed, data, lang) {
    const messageId = data.messageId
    const tokens = [...tokensDelayed]
    await scheduleBackgroundWork(async () => {
      await new Promise((r) => setTimeout(r, PREMIUM_CHAT_PUSH_DELAY_MS))
      const stillSend = await shouldStillSendNewMessagePush(messageId)
      if (!stillSend) {
        console.log('[FCM] Delayed NEW_MESSAGE skipped (read or missing msg):', messageId)
        return
      }
      const rows = await PushService.fetchUserPushTokenRows(_recipientId)
      const silent = await resolveSilentForPushDelivery(_recipientId, rows, {
        bookingId: data.bookingId || null,
        listingId: data.listingId || null,
        emergencyBypass: data.emergencyBypass === true,
      })
      await Promise.allSettled(
        tokens.map((token) =>
          PushService.sendPush(token, 'NEW_MESSAGE', { ...data, silentDelivery: silent }, lang, {
            profileId: _recipientId,
          }),
        ),
      )
    })
  }

  static async mergeOrInsertDelayedChatBatch(recipientId, senderId, tokensDelayed, data, lang) {
    const messageId = data.messageId
    if (!senderId || !messageId) {
      await PushService.scheduleSimpleDelayedPush(recipientId, tokensDelayed, data, lang)
      return
    }

    const deadlineIso = new Date(Date.now() + PREMIUM_CHAT_PUSH_DELAY_MS).toISOString()
    const { data: row, error: selErr } = await supabaseAdmin
      .from('chat_push_delivery_batch')
      .select('*')
      .eq('recipient_id', recipientId)
      .eq('sender_id', String(senderId))
      .maybeSingle()

    if (selErr && isChatBatchTableMissing(selErr)) {
      await PushService.scheduleSimpleDelayedPush(recipientId, tokensDelayed, data, lang)
      return
    }
    if (selErr && !isChatBatchTableMissing(selErr)) {
      console.warn('[FCM] batch select:', selErr.message)
    }

    const applyMerge = async (existing) => {
      const msgIds = [...new Set([...(existing.message_ids || []), messageId])]
      const pTok = [...new Set([...(existing.pending_tokens || []), ...tokensDelayed])]
      const { error: upErr } = await supabaseAdmin
        .from('chat_push_delivery_batch')
        .update({
          message_ids: msgIds,
          pending_tokens: pTok,
          conversation_id: data.conversationId || existing.conversation_id,
          sender_display_name: data.sender || existing.sender_display_name,
          updated_at: new Date().toISOString(),
        })
        .eq('recipient_id', recipientId)
        .eq('sender_id', String(senderId))
      if (upErr) console.warn('[FCM] batch merge:', upErr.message)
    }

    let scheduleLeader = false

    if (row) {
      await applyMerge(row)
    } else {
      const { error: insErr } = await supabaseAdmin.from('chat_push_delivery_batch').insert({
        recipient_id: recipientId,
        sender_id: String(senderId),
        conversation_id: data.conversationId,
        sender_display_name: data.sender,
        message_ids: [messageId],
        pending_tokens: tokensDelayed,
        window_deadline_at: deadlineIso,
      })
      if (insErr) {
        if (isChatBatchTableMissing(insErr)) {
          await PushService.scheduleSimpleDelayedPush(recipientId, tokensDelayed, data, lang)
          return
        }
        const { data: row2 } = await supabaseAdmin
          .from('chat_push_delivery_batch')
          .select('*')
          .eq('recipient_id', recipientId)
          .eq('sender_id', String(senderId))
          .maybeSingle()
        if (row2) {
          await applyMerge(row2)
        } else {
          console.warn('[FCM] batch insert:', insErr.message)
          await PushService.scheduleSimpleDelayedPush(recipientId, tokensDelayed, data, lang)
        }
      } else {
        scheduleLeader = true
      }
    }

    if (scheduleLeader) {
      await scheduleBackgroundWork(() =>
        PushService.runChatPushBatchLeader(recipientId, String(senderId), lang),
      )
    }
  }

  static async runChatPushBatchLeader(recipientId, senderId, lang) {
    const { data: row0 } = await supabaseAdmin
      .from('chat_push_delivery_batch')
      .select('window_deadline_at')
      .eq('recipient_id', recipientId)
      .eq('sender_id', senderId)
      .maybeSingle()
    if (!row0?.window_deadline_at) return

    const deadlineMs = new Date(row0.window_deadline_at).getTime()
    const waitMs = Math.max(0, deadlineMs - Date.now())
    await new Promise((r) => setTimeout(r, waitMs))

    const { data: deletedRows, error: delErr } = await supabaseAdmin
      .from('chat_push_delivery_batch')
      .delete()
      .eq('recipient_id', recipientId)
      .eq('sender_id', senderId)
      .select('*')

    if (delErr || !Array.isArray(deletedRows) || deletedRows.length === 0) return
    const snap = deletedRows[0]
    await PushService.deliverChatBatchSnapshot({
      snap,
      recipientId,
      senderId,
      lang,
      source: 'leader',
    })
  }

  static async resolveRecipientLanguage(recipientId, fallback = 'ru') {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('language')
      .eq('id', recipientId)
      .maybeSingle()
    return String(data?.language || fallback)
  }

  static async deliverChatBatchSnapshot({ snap, recipientId, senderId, lang, source = 'leader' }) {
    const ids = Array.isArray(snap?.message_ids) ? snap.message_ids : []
    const lastId = ids.length ? ids[ids.length - 1] : null
    if (!lastId) {
      return { delivered: 0, reason: 'empty_message_ids', source }
    }

    const stillSend = await shouldStillSendNewMessagePush(lastId)
    if (!stillSend) {
      console.log('[FCM] Batched NEW_MESSAGE skipped (read or missing):', lastId, source)
      return { delivered: 0, reason: 'already_read', source }
    }

    const batchCount = ids.length
    const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
    const cid = encodeURIComponent(snap.conversation_id)
    const link = `${base}/messages/${cid}`
    const tokenRows = await PushService.fetchUserPushTokenRows(recipientId)
    let bookingId = null
    let listingId = null
    if (snap?.conversation_id) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('booking_id')
        .eq('id', String(snap.conversation_id))
        .maybeSingle()
      if (conv?.booking_id) {
        bookingId = bookingId || String(conv.booking_id)
        if (!listingId && bookingId) {
          const { data: b } = await supabaseAdmin
            .from('bookings')
            .select('listing_id')
            .eq('id', String(bookingId))
            .maybeSingle()
          if (b?.listing_id) listingId = String(b.listing_id)
        }
      }
    }
    const silent = await resolveSilentForPushDelivery(recipientId, tokenRows, {
      bookingId,
      listingId,
      emergencyBypass: false,
    })
    const valid = new Set(tokenRows.map((r) => r.token).filter(Boolean))
    const legacy = await PushService.fetchLegacyProfileToken(recipientId)
    if (legacy) valid.add(legacy)
    const pending = [...new Set((snap.pending_tokens || []).filter(Boolean))]
    const readyTokens = pending.filter((t) => valid.has(t))
    if (readyTokens.length === 0) {
      return { delivered: 0, reason: 'no_valid_tokens', source }
    }

    const payload = {
      sender: snap.sender_display_name || getSiteDisplayName(),
      link,
      conversationId: snap.conversation_id,
      messageId: lastId,
      messageBatchCount: String(batchCount),
      senderId,
      silentDelivery: silent,
    }

    const settled = await Promise.allSettled(
      readyTokens.map((token) =>
        PushService.sendPush(token, 'NEW_MESSAGE', payload, lang, { profileId: recipientId }),
      ),
    )
    const delivered = settled.filter((r) => r.status === 'fulfilled' && r.value?.success).length
    return { delivered, attempted: readyTokens.length, source }
  }

  static async runStaleChatPushSweeper({ staleMinutes = 10, limit = 200 } = {}) {
    const cutoffIso = new Date(Date.now() - staleMinutes * 60_000).toISOString()
    const rowErrors = []

    try {
      const { data: staleRows, error } = await supabaseAdmin
        .from('chat_push_delivery_batch')
        .lt('window_deadline_at', cutoffIso)
        .select('*')
        .order('window_deadline_at', { ascending: true })
        .limit(limit)

      if (error) {
        if (isChatBatchTableMissing(error)) {
          return {
            ok: true,
            tableMissing: true,
            staleMinutes,
            cutoffIso,
            checked: 0,
            delivered: 0,
          }
        }
        console.error('[FCM] push-sweeper query failed', error.message, error)
        return {
          ok: false,
          error: error.message || 'sweeper query failed',
          staleMinutes,
          cutoffIso,
          checked: 0,
          delivered: 0,
        }
      }

      const rows = Array.isArray(staleRows) ? staleRows : []
      if (rows.length === 0) {
        return {
          ok: true,
          tableMissing: false,
          staleMinutes,
          cutoffIso,
          checked: 0,
          stuckFound: 0,
          delivered: 0,
          cleared: 0,
          status: 'ok',
        }
      }

      for (const row of rows) {
        const recipientId = row?.recipient_id
        const senderId = String(row?.sender_id || '')
        if (!recipientId || !senderId) continue
        try {
          const { error: delErr } = await supabaseAdmin
            .from('chat_push_delivery_batch')
            .delete()
            .eq('recipient_id', recipientId)
            .eq('sender_id', senderId)
          if (delErr) {
            console.error('[FCM] push-sweeper batch delete', delErr.message, { recipientId, senderId })
          }
        } catch (e) {
          console.error('[FCM] push-sweeper batch delete exception', e?.message, e?.stack, {
            recipientId,
            senderId,
          })
          rowErrors.push({ step: 'delete', recipientId, senderId, message: String(e?.message || e) })
        }
      }

      let delivered = 0
      let stuckFound = 0
      for (const row of rows) {
        stuckFound += 1
        const recipientId = row?.recipient_id
        const senderId = String(row?.sender_id || '')
        if (!recipientId || !senderId) continue
        try {
          const lang = await this.resolveRecipientLanguage(recipientId, 'ru')
          const result = await this.deliverChatBatchSnapshot({
            snap: row,
            recipientId,
            senderId,
            lang,
            source: 'sweeper',
          })
          delivered += Number(result?.delivered || 0)
        } catch (e) {
          console.error('[FCM] push-sweeper deliver row failed', e?.message, e?.stack, {
            recipientId,
            senderId,
            conversationId: row?.conversation_id,
          })
          rowErrors.push({
            step: 'deliver',
            recipientId,
            senderId,
            message: String(e?.message || e),
          })
        }
      }

      return {
        ok: true,
        tableMissing: false,
        staleMinutes,
        cutoffIso,
        checked: rows.length,
        stuckFound,
        delivered,
        cleared: rows.length,
        status: rows.length > 0 ? 'stuck_messages_found' : 'ok',
        rowErrors: rowErrors.length ? rowErrors : undefined,
      }
    } catch (e) {
      console.error('[FCM] runStaleChatPushSweeper fatal', e?.message, e?.stack)
      return {
        ok: false,
        error: e?.message || String(e),
        staleMinutes,
        cutoffIso,
        rowErrors: rowErrors.length ? rowErrors : undefined,
      }
    }
  }

  static async getAccessToken() {
    return getFcmAccessToken()
  }

  /** @deprecated Используйте {@link signFirebaseServiceAccountJwt} из `lib/services/push/firebase-oauth.js`. */
  static async signJwt(header, payload, privateKey) {
    return transportSignJwt(header, payload, privateKey)
  }

  /** @deprecated Используйте {@link firebaseBase64UrlEncode} из `lib/services/push/firebase-oauth.js`. */
  static base64UrlEncode(str) {
    return transportBase64UrlEncode(str)
  }

  static async sendPush(fcmToken, templateKey, data = {}, lang = 'ru', logContext = {}) {
    if (!fcmToken) {
      return { success: false, error: 'No FCM token' }
    }
    const traceUid = logContext?.profileId ?? '?'

    const rendered = buildRenderedPushNotification(templateKey, data, lang)
    if (!rendered.ok) {
      return { success: false, error: rendered.error }
    }

    const silent =
      data.emergencyBypass === true
        ? false
        : data.silentDelivery === true ||
          data.silentDelivery === 'true' ||
          String(data.silentDelivery || '') === '1'

    const dataStrings = buildPushDataStrings(templateKey, data, silent)

    const message = buildFcmTemplateEnvelope({
      fcmToken,
      templateKey,
      title: rendered.title,
      body: rendered.body,
      dataStrings,
      silent,
    })

    return deliverFcmNotification({
      fcmToken,
      message,
      traceUid,
      templateKey,
    })
  }

  static async sendToUser(userId, templateKey, data = {}) {
    try {
      console.log(`[PUSH_FLOW] sendToUser start user=${userId} template=${templateKey}`)
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('language, role')
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

      const lang = profile.language || 'ru'
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
    const rows = await this.fetchUserPushTokenRows(userId)
    const byToken = new Map()
    for (const row of rows) {
      if (row.token) byToken.set(row.token, row)
    }
    if (legacyToken && !byToken.has(legacyToken)) {
      byToken.set(legacyToken, {
        token: legacyToken,
        last_seen_at: null,
        device_info: {},
      })
    }
    const enriched = [...byToken.values()]
    if (enriched.length === 0) {
      console.log(`[FCM] No token for user ${userId}`)
      return { success: false, error: 'No FCM token' }
    }

    const instant = []
    const delayed = []
    if (FCM_INSTANT_PUSH_DEBUG) {
      console.log('[FCM] FCM_INSTANT_PUSH_DEBUG=1 — instant NEW_MESSAGE for all tokens (no delayed batch)')
      for (const row of enriched) instant.push(row.token)
    } else {
      for (const row of enriched) delayed.push(row.token)
    }

    let ok = 0
    let fail = 0
    if (instant.length) {
      const silentInstant = await resolveSilentForPushDelivery(userId, enriched, {
        bookingId: data.bookingId || null,
        listingId: data.listingId || null,
        emergencyBypass: data.emergencyBypass === true,
      })
      const settled = await Promise.allSettled(
        instant.map((token) =>
          this.sendPush(token, 'NEW_MESSAGE', { ...data, silentDelivery: silentInstant }, lang, {
            profileId: userId,
          }),
        ),
      )
      const passed = settled.filter((r) => r.status === 'fulfilled' && r.value?.success).length
      ok += passed
      fail += settled.length - passed
    }

    if (delayed.length) {
      const tokensDelayed = [...delayed]
      await this.mergeOrInsertDelayedChatBatch(userId, data.senderId, tokensDelayed, data, lang)
    }

    return {
      success: ok > 0 || delayed.length > 0,
      sent: ok,
      failed: fail,
      total: enriched.length,
      smartInstant: instant.length,
      smartScheduled: delayed.length,
    }
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
        link: `/renter/bookings?booking=${encodeURIComponent(String(booking.id))}`,
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
        link: `/renter/bookings?booking=${encodeURIComponent(String(booking.id))}`,
      })
    } catch (error) {
      console.error('[FCM] Review reminder error:', error.message)
      return { success: false, error: error.message }
    }
  }

  static async registerToken(userId, fcmToken, deviceInfo = null) {
    try {
      const nowIso = new Date().toISOString()
      const row = {
        user_id: userId,
        token: fcmToken,
        device_info: deviceInfo && typeof deviceInfo === 'object' ? deviceInfo : {},
        last_seen_at: nowIso,
      }
      let { error } = await supabaseAdmin.from('user_push_tokens').upsert(row, {
        onConflict: 'token',
        ignoreDuplicates: false,
      })

      if (
        error &&
        /last_seen_at/i.test(String(error?.message || '')) &&
        /does not exist|column/i.test(String(error?.message || ''))
      ) {
        const { last_seen_at: _ls, ...withoutSeen } = row
        ;({ error } = await supabaseAdmin.from('user_push_tokens').upsert(withoutSeen, {
          onConflict: 'token',
          ignoreDuplicates: false,
        }))
      }

      if (error && !String(error?.message || '').includes(TABLE_MISSING_SNIPPET)) {
        throw error
      }

      await supabaseAdmin
        .from('profiles')
        .update({
          fcm_token: fcmToken,
          fcm_updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      console.log(`[FCM] Registered token for user ${userId}`)
      return { success: true }
    } catch (error) {
      console.error('[FCM] Register token error:', error.message)
      return { success: false, error: error.message }
    }
  }

  static async touchTokenLastSeen(userId, fcmToken) {
    if (!userId || !fcmToken) {
      return { success: false, error: 'userId and token required' }
    }
    try {
      const nowIso = new Date().toISOString()
      let { data, error } = await supabaseAdmin
        .from('user_push_tokens')
        .update({ last_seen_at: nowIso })
        .eq('user_id', userId)
        .eq('token', fcmToken)
        .select('token')
      if (
        error &&
        /last_seen_at/i.test(String(error?.message || '')) &&
        /does not exist|column/i.test(String(error?.message || ''))
      ) {
        return { success: true, noop: true, reason: 'last_seen_at column missing' }
      }
      if (error) {
        if (!String(error?.message || '').includes(TABLE_MISSING_SNIPPET)) {
          console.warn('[FCM] touchTokenLastSeen:', error.message)
        }
        return { success: false, error: error.message }
      }
      if (!data?.length) {
        return { success: false, error: 'Token not registered' }
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: e?.message || 'touch failed' }
    }
  }

  static async sendSilentBadgeUpdate(fcmToken, unreadCount) {
    if (!fcmToken) return { success: false, error: 'No FCM token' }
    try {
      const message = buildSilentBadgeFcmPayload(fcmToken, unreadCount)
      return deliverFcmNotification({
        fcmToken,
        message,
        traceUid: '(badge)',
        templateKey: 'badge_update',
      })
    } catch (e) {
      console.warn('[FCM] sendSilentBadgeUpdate error:', e?.message)
      return { success: false, error: e?.message }
    }
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
