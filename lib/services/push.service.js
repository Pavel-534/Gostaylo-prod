/**
 * Firebase Push Notification Service (FCM)
 * Server-side integration for real-time alerts; display name SSOT: getSiteDisplayName()
 * 
 * Triggers:
 * - New chat messages (if user offline)
 * - Booking status changes
 * - Check-in confirmation reminders (14:00 on check-in day)
 * - Payment confirmations
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url.js'
import {
  buildPushFirebaseConfig,
  buildFcmSendUrl,
  signFirebaseServiceAccountJwt,
  base64UrlEncode as firebaseBase64UrlEncode,
} from '@/lib/services/push/firebase-oauth.js'
import {
  NOTIFICATION_TEMPLATES,
  normalizePushUiLang,
  pickLocalizedTemplateStrings,
} from '@/lib/services/push/notification-templates.js'
import {
  WEB_ACTIVE_WINDOW_MS,
  PREMIUM_CHAT_PUSH_DELAY_MS,
  FCM_INSTANT_PUSH_DEBUG,
  resolveSilentForPushDelivery,
} from '@/lib/services/push/push-quiet-policy.js'
import {
  buildFcmTemplateEnvelope,
  postFcmV1Message,
  parseFcmHttpError,
} from '@/lib/services/push/fcm-http-delivery.js'
import { interpolatePushTemplate } from '@/lib/services/push/push-interpolate.js'

/** FCM WebPush требует абсолютный URL; относительные пути (/messages/...) дополняем origin из getPublicSiteUrl(). */
function absolutizePushLink(link) {
  const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
  if (!link || typeof link !== 'string') return `${base}/`
  if (/^https?:\/\//i.test(link.trim())) return link.trim()
  const path = link.startsWith('/') ? link : `/${link}`
  return `${base}${path}`
}

const FIREBASE_CONFIG = buildPushFirebaseConfig()
const FCM_URL = buildFcmSendUrl(FIREBASE_CONFIG.project_id)
const TABLE_MISSING_SNIPPET = "Could not find the table 'public.user_push_tokens'"

function logPushSentTrace(userId, status, fcmToken) {
  const snippet = String(fcmToken || '').slice(0, 10)
  const safe = String(status ?? '')
    .replace(/\r?\n/g, ' ')
    .slice(0, 240)
  console.log(`[PUSH_SENT] To: ${userId ?? '?'}, Status: ${safe}, Token_Snippet: ${snippet}`)
}

/**
 * Держит setTimeout живым на Vercel (waitUntil); локально — fire-and-forget.
 */
async function scheduleBackgroundWork(task) {
  const promise = (async () => {
    try {
      await task()
    } catch (e) {
      console.error('[FCM] Background task error:', e?.message || e)
    }
  })()
  try {
    const { waitUntil } = await import('@vercel/functions')
    if (typeof waitUntil === 'function') {
      waitUntil(promise)
      return
    }
  } catch {
    // пакет отсутствует или не Vercel
  }
  void promise
}

function isChatBatchTableMissing(err) {
  const m = String(err?.message || '')
  return m.includes('chat_push_delivery_batch') && m.includes('Could not find the table')
}

// Access token cache
let accessToken = null;
let tokenExpiry = 0;

export class PushService {
  static async fetchUserTokens(userId) {
    const rows = await this.fetchUserPushTokenRows(userId)
    return Array.from(new Set(rows.map((r) => r.token).filter(Boolean)))
  }

  /** Строки токенов для Smart Push (last_seen_at + device_info). */
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
    if (!fcmToken) return
    const { error } = await supabaseAdmin.from('user_push_tokens').delete().eq('token', fcmToken)
    if (error && !String(error?.message || '').includes(TABLE_MISSING_SNIPPET)) {
      console.warn('[FCM] delete stale token:', error.message)
    } else {
      console.log(`[FCM] Removed invalid token ...${String(fcmToken).slice(-8)}`)
      void PushService.recordFcmCleanedSignal(String(fcmToken).slice(-8))
    }
    // Legacy column — иначе sendToUser продолжит слать на мёртвый токен.
    const { error: profErr } = await supabaseAdmin
      .from('profiles')
      .update({ fcm_token: null, fcm_updated_at: new Date().toISOString() })
      .eq('fcm_token', fcmToken)
    if (profErr && !String(profErr?.message || '').includes('column')) {
      console.warn('[FCM] clear profiles.fcm_token:', profErr.message)
    }
  }

  static async recordFcmCleanedSignal(tokenSuffix = '') {
    try {
      const { error } = await supabaseAdmin.from('critical_signal_events').insert({
        signal_key: 'FCM_TOKEN_CLEANED',
        detail: { tokenSuffix, source: 'push.service.deleteInvalidPushToken' },
      })
      if (
        error &&
        !String(error.message || '').includes("Could not find the table 'public.critical_signal_events'")
      ) {
        console.warn('[FCM] critical_signal_events insert:', error.message)
      }
    } catch {
      /* optional telemetry */
    }
  }

  /** false = не слать (прочитано или сообщение не найдено). */
  static async shouldStillSendNewMessagePush(messageId) {
    if (!messageId) return true
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('is_read')
      .eq('id', messageId)
      .maybeSingle()
    if (error || !data) return false
    return data.is_read !== true
  }

  static pickRecipientTimezone(tokenRows) {
    const rows = Array.isArray(tokenRows) ? tokenRows : []
    for (const r of rows) {
      const z = r?.device_info?.timezone
      if (typeof z === 'string' && z.trim().length > 2) return z.trim()
    }
    return 'UTC'
  }

  /**
   * Legacy fallback: profiles.fcm_token может отсутствовать на новых схемах.
   * Не должен ломать отправку, если колонка удалена.
   */
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
      const stillSend = await PushService.shouldStillSendNewMessagePush(messageId)
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

    const stillSend = await PushService.shouldStillSendNewMessagePush(lastId)
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
  
  /**
   * Get Firebase access token using service account
   * @returns {Promise<string>} Access token
   */
  static async getAccessToken() {
    const now = Date.now();
    
    // Return cached token if valid
    if (accessToken && tokenExpiry > now + 60000) {
      return accessToken;
    }

    try {
      if (!FIREBASE_CONFIG.client_email || !FIREBASE_CONFIG.private_key) {
        const msg =
          'Firebase service account missing: set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (and FIREBASE_PROJECT_ID) in Vercel'
        console.error('[FCM] Token error:', msg)
        throw new Error(msg)
      }

      // Create JWT for Google OAuth
      const header = {
        alg: 'RS256',
        typ: 'JWT'
      };

      const claimSet = {
        iss: FIREBASE_CONFIG.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: Math.floor(now / 1000),
        exp: Math.floor(now / 1000) + 3600
      };

      const signedJwt = await signFirebaseServiceAccountJwt(header, claimSet, FIREBASE_CONFIG.private_key)

      // Exchange JWT for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: signedJwt
        })
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error('[FCM] Token error:', error);
        throw new Error('Failed to get access token');
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
      tokenExpiry = now + (tokenData.expires_in * 1000);

      console.log('[FCM] Got new access token, expires in', tokenData.expires_in, 'seconds');
      return accessToken;

    } catch (error) {
      console.error('[FCM] Token error:', error.message);
      throw error;
    }
  }

  /**
   * @deprecated Используйте {@link signFirebaseServiceAccountJwt} из `lib/services/push/firebase-oauth.js`.
   */
  static async signJwt(header, payload, privateKey) {
    return signFirebaseServiceAccountJwt(header, payload, privateKey)
  }

  /** @deprecated Используйте {@link firebaseBase64UrlEncode} из `lib/services/push/firebase-oauth.js`. */
  static base64UrlEncode(str) {
    return firebaseBase64UrlEncode(str)
  }

  /**
   * Send push notification to a specific device
   * @param {string} fcmToken - Device FCM token
   * @param {string} templateKey - Template name
   * @param {object} data - Template variables
   * @param {string} lang - Language (ru or en)
   * @returns {Promise<object>} Send result
   */
  static async sendPush(fcmToken, templateKey, data = {}, lang = 'ru', logContext = {}) {
    if (!fcmToken) {
      return { success: false, error: 'No FCM token' };
    }
    const traceUid = logContext?.profileId ?? '?'
    const tokenStr = String(fcmToken)

    try {
      const template = NOTIFICATION_TEMPLATES[templateKey];
      if (!template) {
        return { success: false, error: `Unknown template: ${templateKey}` };
      }

      const token = await this.getAccessToken();

      const silent =
        data.emergencyBypass === true
          ? false
          : data.silentDelivery === true ||
            data.silentDelivery === 'true' ||
            String(data.silentDelivery || '') === '1'

      const batchN = Number(data.messageBatchCount || 0)
      const uiLang = normalizePushUiLang(lang)
      const defaultSender =
        uiLang === 'en'
          ? 'Someone'
          : uiLang === 'zh'
            ? '联系人'
            : uiLang === 'th'
              ? 'ผู้ติดต่อ'
              : 'Собеседник'
      const defaultNewMessageBody =
        uiLang === 'en'
          ? 'New message'
          : uiLang === 'zh'
            ? '新消息'
            : uiLang === 'th'
              ? 'ข้อความใหม่'
              : 'Новое сообщение'
      const siteName = getSiteDisplayName()
      const dataForTemplate =
        templateKey === 'NEW_MESSAGE'
          ? {
              ...data,
              siteName,
              sender:
                (data.sender && String(data.sender).trim()) || defaultSender,
              message: (() => {
                const m = data.message != null ? String(data.message).trim() : ''
                return m || defaultNewMessageBody
              })(),
            }
          : { ...data, siteName }

      const { title: titleTpl, body: bodyTpl } = pickLocalizedTemplateStrings(template, lang)
      const title = interpolatePushTemplate(titleTpl, dataForTemplate)
      let body
      if (templateKey === 'NEW_MESSAGE' && batchN > 1) {
        const s = dataForTemplate.sender || (uiLang === 'en' ? 'someone' : uiLang === 'zh' ? '对方' : uiLang === 'th' ? 'ผู้ติดต่อ' : 'собеседника')
        body =
          uiLang === 'en'
            ? `You have new messages from ${s}`
            : uiLang === 'zh'
              ? `您有多条来自 ${s} 的新消息`
              : uiLang === 'th'
                ? `มีข้อความใหม่หลายข้อความจาก ${s}`
                : `У вас новых сообщений от ${s}`
      } else {
        body = interpolatePushTemplate(bodyTpl, dataForTemplate)
      }

      const linkAbsolute = absolutizePushLink(data.link || '/')
      const dataPayload = { ...data, link: linkAbsolute }
      if (silent) {
        dataPayload.silent = '1'
      }

      const dataStrings = Object.fromEntries(
        Object.entries(dataPayload).map(([k, v]) => [k, String(v)]),
      )

      const message = buildFcmTemplateEnvelope({
        fcmToken,
        templateKey,
        title,
        body,
        dataStrings,
        silent,
      })

      const tokenPreview =
        tokenStr.length > 12 ? `${tokenStr.slice(0, 10)}…(len=${tokenStr.length})` : `(short token)`
      const verbose = process.env.FCM_VERBOSE_LOG === '1'

      console.log('[FCM Debug] Target profile:', logContext?.profileId ?? '(not passed)')
      console.log('[FCM Debug] Token used:', tokenPreview)
      console.log('[FCM Debug] template / silent / lang:', templateKey, silent, lang)
      if (verbose) {
        console.log('[FCM Debug] Full outbound message:', JSON.stringify(message, null, 2))
      } else {
        console.log(
          '[FCM Debug] Outbound summary:',
          JSON.stringify({
            hasNotification: Boolean(message.message.notification),
            hasWebpushNotification: Boolean(message.message.webpush?.notification),
            dataKeys: Object.keys(message.message.data || {}),
            android: message.message.android,
          }),
        )
      }

      const response = await postFcmV1Message(FCM_URL, token, message)
      const rawText = response.rawText
      console.log('[FCM Debug] Firebase HTTP:', response.status, response.ok ? 'OK' : 'ERR')
      console.log(
        '[FCM Debug] Firebase response:',
        verbose
          ? rawText
          : `${String(rawText).slice(0, 1200)}${String(rawText).length > 1200 ? '…(truncated; set FCM_VERBOSE_LOG=1 for full)' : ''}`,
      )

      if (!response.ok) {
        const { message: errMsg, stale } = parseFcmHttpError(rawText, response.status)
        if (stale) await PushService.deleteInvalidPushToken(fcmToken)
        const statusLine = stale ? `STALE_HTTP_${response.status}` : `FAIL_HTTP_${response.status}`
        logPushSentTrace(traceUid, `${statusLine}:${errMsg}`, fcmToken)
        console.error('[FCM] Send error:', errMsg, stale ? '(stale token removed)' : '', {
          status: response.status,
          bodyPreview: String(rawText).slice(0, 500),
        })
        return { success: false, error: errMsg }
      }

      let result
      try {
        result = JSON.parse(rawText)
      } catch {
        logPushSentTrace(traceUid, 'FAIL:200:invalid_json', fcmToken)
        return { success: false, error: 'Invalid FCM response JSON' }
      }
      console.log(`[FCM] Sent ${templateKey} name=${result?.name || '?'} token …${tokenStr.slice(-6)}`)
      logPushSentTrace(traceUid, `OK:${result?.name || '?'}`, fcmToken)
      return { success: true, messageId: result.name }
    } catch (error) {
      const em = String(error?.message || error)
      if (
        /Requested entity was not found|registration-token-not-registered|not a valid FCM registration token/i.test(
          em,
        )
      ) {
        await PushService.deleteInvalidPushToken(fcmToken)
      }
      logPushSentTrace(traceUid, `EX:${em}`, fcmToken)
      console.error('[FCM] Send exception:', em, error?.stack)
      return { success: false, error: em }
    }
  }

  /**
   * Send push to user by user ID
   * @param {string} userId - User ID
   * @param {string} templateKey - Template name
   * @param {object} data - Template variables
   */
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

      const role = (profile.role || '').toUpperCase()
      if (
        templateKey === 'NEW_MESSAGE' &&
        (role === 'ADMIN' || role === 'MODERATOR')
      ) {
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

  /**
   * Smart Delivery + Premium Quiet Policy (v3): все NEW_MESSAGE уходят в отложенную очередь (~40 с),
   * кроме режима `FCM_INSTANT_PUSH_DEBUG`. Перед FCM проверяется `messages.is_read` (батч и simple-delay).
   * `last_seen_at` / `isWebActiveRecently` остаются для метрик и будущих веток; мгновенной отправки по «hot» нет.
   */
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

  /**
   * Уведомить всех ADMIN/MODERATOR об эскалации диалога (не использует фильтр NEW_MESSAGE).
   */
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
        }).catch((e) => console.error('[FCM] support escalate', row.id, e?.message || e))
      )
    )

    return { success: true, notified: staff.length }
  }

  /**
   * Send check-in reminder push
   * Called by cron at 14:00 on check-in day
   * @param {string} bookingId - Booking ID
   */
  static async sendCheckInReminder(bookingId) {
    try {
      const { data: booking, error } = await supabaseAdmin
        .from('bookings')
        .select(`
          id,
          guest_name,
          guest_email,
          renter_id,
          listing:listings(id, title)
        `)
        .eq('id', bookingId)
        .single();

      if (error || !booking) {
        return { success: false, error: 'Booking not found' };
      }

      return this.sendToUser(booking.renter_id, 'CHECKIN_REMINDER', {
        listing: booking.listing?.title,
        bookingId: booking.id,
        link: `/renter/bookings?booking=${encodeURIComponent(String(booking.id))}`,
      });

    } catch (error) {
      console.error('[FCM] Check-in reminder error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Ask guest to leave a review ~24h after check-out day (cron).
   * @param {string} bookingId
   */
  static async sendReviewReminder(bookingId) {
    try {
      const { data: booking, error } = await supabaseAdmin
        .from('bookings')
        .select(`
          id,
          guest_name,
          renter_id,
          listing:listings(id, title)
        `)
        .eq('id', bookingId)
        .single();

      if (error || !booking) {
        return { success: false, error: 'Booking not found' };
      }

      return this.sendToUser(booking.renter_id, 'REVIEW_REMINDER', {
        listing: booking.listing?.title,
        bookingId: booking.id,
        link: `/renter/bookings?booking=${encodeURIComponent(String(booking.id))}`,
      });
    } catch (error) {
      console.error('[FCM] Review reminder error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register FCM token for a user
   * @param {string} userId - User ID
   * @param {string} fcmToken - FCM token
   */
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

      // Backward-compat mirror for legacy code paths during migration.
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

  /** Лёгкий heartbeat: обновить last_seen_at без полного upsert device_info. */
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

  /**
   * Sends a silent (data-only) push to update the notification badge count.
   * Does not display a notification — only tells the browser/PWA to update badge.
   *
   * @param {string} fcmToken - FCM registration token
   * @param {number} unreadCount - Current unread message count
   */
  static async sendSilentBadgeUpdate(fcmToken, unreadCount) {
    if (!fcmToken) return { success: false, error: 'No FCM token' }
    try {
      const token = await this.getAccessToken()

      const message = {
        message: {
          token: fcmToken,
          data: {
            type: 'badge_update',
            unread_count: String(unreadCount),
          },
          webpush: {
            headers: {
              // Тихий push — без показа уведомления
              'Content-Available': '1',
            },
          },
          android: {
            priority: 'normal',
          },
          apns: {
            headers: { 'apns-priority': '5' },
            payload: {
              aps: { 'content-available': 1, badge: unreadCount },
            },
          },
        },
      }

      const res = await postFcmV1Message(FCM_URL, token, message)
      const rawText = res.rawText
      if (!res.ok) {
        const { message: errMsg, stale } = parseFcmHttpError(rawText, res.status)
        if (stale) await PushService.deleteInvalidPushToken(fcmToken)
        console.warn('[FCM] Badge update failed:', errMsg)
        return { success: false, error: errMsg }
      }
      try {
        JSON.parse(rawText)
      } catch {
        return { success: false, error: 'Invalid FCM JSON' }
      }
      return { success: true, unreadCount }
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

  /**
   * @deprecated Prefer {@link interpolatePushTemplate} from `push-interpolate.js`.
   */
  static interpolate(template, data) {
    return interpolatePushTemplate(template, data)
  }
}

export default PushService;
