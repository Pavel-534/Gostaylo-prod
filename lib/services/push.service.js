/**
 * GoStayLo - Firebase Push Notification Service
 * Server-side FCM integration for real-time alerts
 * 
 * Triggers:
 * - New chat messages (if user offline)
 * - Booking status changes
 * - Check-in confirmation reminders (14:00 on check-in day)
 * - Payment confirmations
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getPublicSiteUrl } from '@/lib/site-url.js'

/** FCM WebPush требует абсолютный URL; относительные пути (/messages/...) дополняем origin из getPublicSiteUrl(). */
function absolutizePushLink(link) {
  const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
  if (!link || typeof link !== 'string') return `${base}/`
  if (/^https?:\/\//i.test(link.trim())) return link.trim()
  const path = link.startsWith('/') ? link : `/${link}`
  return `${base}${path}`
}

// Firebase Admin SDK configuration - loaded from environment variables
const FIREBASE_CONFIG = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "gostaylo-push",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL
};

// FCM API URL
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${FIREBASE_CONFIG.project_id}/messages:send`;
const TABLE_MISSING_SNIPPET = "Could not find the table 'public.user_push_tokens'"

/** Окно «веб-вкладка активна» для мгновенного пуша нового сообщения */
const WEB_ACTIVE_WINDOW_MS = 60_000
/** Отложенная доставка на «мобильные» / неактивный веб — с проверкой is_read */
const MOBILE_PUSH_DELAY_MS = 45_000

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

// Notification templates
const NOTIFICATION_TEMPLATES = {
  NEW_MESSAGE: {
    title: '💬 Новое сообщение',
    titleEn: '💬 New Message',
    body: 'У вас новое сообщение от {sender}',
    bodyEn: 'You have a new message from {sender}',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'message',
    requireInteraction: false
  },
  BOOKING_REQUEST: {
    title: '🏠 Новая заявка на бронирование',
    titleEn: '🏠 New Booking Request',
    body: 'Получена заявка на {listing} ({dates})',
    bodyEn: 'New booking request for {listing} ({dates})',
    icon: '/icons/icon-192x192.png',
    tag: 'booking',
    requireInteraction: true
  },
  BOOKING_CONFIRMED: {
    title: '✅ Бронирование подтверждено',
    titleEn: '✅ Booking Confirmed',
    body: 'Ваше бронирование "{listing}" подтверждено',
    bodyEn: 'Your booking "{listing}" is confirmed',
    icon: '/icons/icon-192x192.png',
    tag: 'booking'
  },
  PAYMENT_RECEIVED: {
    title: '💰 Платёж получен',
    titleEn: '💰 Payment Received',
    body: 'Получен платёж ฿{amount} за {listing}',
    bodyEn: 'Payment received ฿{amount} for {listing}',
    icon: '/icons/icon-192x192.png',
    tag: 'payment'
  },
  CHECKIN_REMINDER: {
    title: '🔑 Подтвердите прибытие',
    titleEn: '🔑 Confirm Your Arrival',
    body: 'Добро пожаловать! Пожалуйста, подтвердите заезд в "{listing}"',
    bodyEn: 'Welcome! Please confirm your check-in at "{listing}"',
    icon: '/icons/icon-192x192.png',
    tag: 'checkin',
    requireInteraction: true,
    actions: [
      { action: 'confirm', title: 'Подтвердить' },
      { action: 'help', title: 'Нужна помощь' }
    ]
  },
  PAYOUT_READY: {
    title: '💸 Выплата готова',
    titleEn: '💸 Payout Ready',
    body: 'Ваши средства ฿{amount} разморожены и готовы к выплате',
    bodyEn: 'Your funds ฿{amount} are thawed and ready for payout',
    icon: '/icons/icon-192x192.png',
    tag: 'payout'
  },
  SUPPORT_REQUESTED: {
    title: '🆘 Нужна помощь в чате',
    titleEn: '🆘 Support needed',
    body: 'Запрос поддержки в диалоге {conversationId}',
    bodyEn: 'Support requested in conversation {conversationId}',
    icon: '/icons/icon-192x192.png',
    tag: 'support_escalation',
    requireInteraction: true,
  },
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

  static isWebSurface(deviceInfo) {
    const di = deviceInfo && typeof deviceInfo === 'object' ? deviceInfo : {}
    if (di.surface === 'web') return true
    if (di.surface === 'native' || di.surface === 'mobile') return false
    const ua = String(di.userAgent || '')
    if (!ua) return false
    return /Mozilla|Chrome|Safari|Firefox|Edg/i.test(ua)
  }

  static isWebActiveRecently(lastSeenAtIso) {
    if (!lastSeenAtIso) return false
    const t = new Date(lastSeenAtIso).getTime()
    if (!Number.isFinite(t)) return false
    return Date.now() - t < WEB_ACTIVE_WINDOW_MS
  }

  static parseFcmHttpError(rawText) {
    let parsed = null
    try {
      parsed = JSON.parse(rawText)
    } catch {
      /* text body */
    }
    const message = parsed?.error?.message || rawText || 'FCM error'
    let errorCode = null
    const details = parsed?.error?.details
    if (Array.isArray(details)) {
      for (const d of details) {
        if (d && typeof d === 'object' && d.errorCode) {
          errorCode = d.errorCode
          break
        }
      }
    }
    const msg = String(message)
    const stale =
      errorCode === 'UNREGISTERED' ||
      /registration-token-not-registered|UNREGISTERED|Requested entity was not found|not a valid FCM registration token/i.test(
        msg,
      )
    return { message: msg, stale }
  }

  static async deleteInvalidPushToken(fcmToken) {
    if (!fcmToken) return
    const { error } = await supabaseAdmin.from('user_push_tokens').delete().eq('token', fcmToken)
    if (error && !String(error?.message || '').includes(TABLE_MISSING_SNIPPET)) {
      console.warn('[FCM] delete stale token:', error.message)
    } else {
      console.log(`[FCM] Removed invalid token ...${String(fcmToken).slice(-8)}`)
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

      // Sign JWT (simplified - in production use proper JWT library)
      const signedJwt = await this.signJwt(header, claimSet, FIREBASE_CONFIG.private_key);

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
   * Sign JWT using RS256 (using Web Crypto API)
   */
  static async signJwt(header, payload, privateKey) {
    const encoder = new TextEncoder();
    
    // Base64url encode header and payload
    const headerB64 = this.base64UrlEncode(JSON.stringify(header));
    const payloadB64 = this.base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${headerB64}.${payloadB64}`;

    // Import private key
    const keyData = privateKey
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\n/g, '');
    
    const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      encoder.encode(signingInput)
    );

    const signatureB64 = this.base64UrlEncode(
      String.fromCharCode(...new Uint8Array(signature))
    );

    return `${signingInput}.${signatureB64}`;
  }

  /**
   * Base64 URL encode
   */
  static base64UrlEncode(str) {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Send push notification to a specific device
   * @param {string} fcmToken - Device FCM token
   * @param {string} templateKey - Template name
   * @param {object} data - Template variables
   * @param {string} lang - Language (ru or en)
   * @returns {Promise<object>} Send result
   */
  static async sendPush(fcmToken, templateKey, data = {}, lang = 'ru') {
    if (!fcmToken) {
      return { success: false, error: 'No FCM token' };
    }

    try {
      const template = NOTIFICATION_TEMPLATES[templateKey];
      if (!template) {
        return { success: false, error: `Unknown template: ${templateKey}` };
      }

      const token = await this.getAccessToken();
      
      // Build notification content
      const title = lang === 'en' ? template.titleEn : template.title;
      const body = this.interpolate(
        lang === 'en' ? template.bodyEn : template.body, 
        data
      );

      const linkAbsolute = absolutizePushLink(data.link || '/')
      const dataPayload = { ...data, link: linkAbsolute }

      const message = {
        message: {
          token: fcmToken,
          webpush: {
            headers: {
              Urgency: 'high',
            },
            fcm_options: {
              link: linkAbsolute,
            }
          },
          data: {
            type: templateKey,
            _title: title,
            _body: body,
            ...Object.fromEntries(
              Object.entries(dataPayload).map(([k, v]) => [k, String(v)])
            )
          }
        }
      };

      const response = await fetch(FCM_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      const rawText = await response.text();
      if (!response.ok) {
        const { message: errMsg, stale } = PushService.parseFcmHttpError(rawText);
        if (stale) await PushService.deleteInvalidPushToken(fcmToken);
        console.error('[FCM] Send error:', errMsg);
        return { success: false, error: errMsg };
      }

      let result;
      try {
        result = JSON.parse(rawText);
      } catch {
        return { success: false, error: 'Invalid FCM response JSON' };
      }
      console.log(`[FCM] Sent ${templateKey} to token ...${fcmToken.slice(-6)}`);
      
      return { success: true, messageId: result.name };

    } catch (error) {
      console.error('[FCM] Send error:', error.message);
      return { success: false, error: error.message };
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
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('fcm_token, language, role')
        .eq('id', userId)
        .single()

      if (error || !profile) {
        return { success: false, error: error?.message || 'Profile not found' }
      }

      const role = (profile.role || '').toUpperCase()
      if (
        templateKey === 'NEW_MESSAGE' &&
        (role === 'ADMIN' || role === 'MODERATOR')
      ) {
        return { success: true, skipped: true, reason: 'staff_no_chat_push' }
      }

      const lang = profile.language || 'ru'
      const legacyToken = String(profile.fcm_token || '').trim()

      if (templateKey === 'NEW_MESSAGE' && data.messageId) {
        return this.sendNewMessageWithSmartDelivery(userId, data, lang, legacyToken)
      }

      const tableTokens = await this.fetchUserTokens(userId)
      const allTokens = Array.from(new Set([...tableTokens, ...(legacyToken ? [legacyToken] : [])]))
      if (allTokens.length === 0) {
        console.log(`[FCM] No token for user ${userId}`)
        return { success: false, error: 'No FCM token' }
      }

      const settled = await Promise.allSettled(
        allTokens.map((token) => this.sendPush(token, templateKey, data, lang)),
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
      return { success: false, error: error.message }
    }
  }

  /**
   * Smart Delivery: активный веб (<1 мин по last_seen_at) — сразу; иначе — через 45 с, если сообщение ещё не прочитано.
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
    for (const row of enriched) {
      const web = this.isWebSurface(row.device_info)
      const hot = web && this.isWebActiveRecently(row.last_seen_at)
      if (hot) instant.push(row.token)
      else delayed.push(row.token)
    }

    let ok = 0
    let fail = 0
    if (instant.length) {
      const settled = await Promise.allSettled(
        instant.map((token) => this.sendPush(token, 'NEW_MESSAGE', data, lang)),
      )
      const passed = settled.filter((r) => r.status === 'fulfilled' && r.value?.success).length
      ok += passed
      fail += settled.length - passed
    }

    const messageId = data.messageId
    if (delayed.length) {
      const tokensDelayed = [...delayed]
      await scheduleBackgroundWork(async () => {
        await new Promise((r) => setTimeout(r, MOBILE_PUSH_DELAY_MS))
        const stillSend = await PushService.shouldStillSendNewMessagePush(messageId)
        if (!stillSend) {
          console.log('[FCM] Delayed NEW_MESSAGE skipped (read or missing msg):', messageId)
          return
        }
        await Promise.allSettled(
          tokensDelayed.map((token) =>
            PushService.sendPush(token, 'NEW_MESSAGE', data, lang),
          ),
        )
      })
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
        link: `/my-bookings/${booking.id}`
      });

    } catch (error) {
      console.error('[FCM] Check-in reminder error:', error.message);
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
      const projectId = process.env.FIREBASE_PROJECT_ID
      if (!projectId) return { success: false, error: 'No project id' }

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

      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        },
      )
      const rawText = await res.text()
      if (!res.ok) {
        const { message: errMsg, stale } = PushService.parseFcmHttpError(rawText)
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
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('fcm_token')
        .eq('id', userId)
        .maybeSingle()
      const legacyToken = String(profile?.fcm_token || '').trim()
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
   * Interpolate template variables
   * @param {string} template - Template string with {placeholders}
   * @param {object} data - Data object
   * @returns {string} Interpolated string
   */
  static interpolate(template, data) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }
}

export default PushService;
