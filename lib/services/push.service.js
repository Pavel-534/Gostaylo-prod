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

      if (!response.ok) {
        const error = await response.text();
        console.error('[FCM] Send error:', error);
        return { success: false, error };
      }

      const result = await response.json();
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

      if (error || !profile?.fcm_token) {
        console.log(`[FCM] No token for user ${userId}`)
        return { success: false, error: 'No FCM token' }
      }

      const role = (profile.role || '').toUpperCase()
      if (
        templateKey === 'NEW_MESSAGE' &&
        (role === 'ADMIN' || role === 'MODERATOR')
      ) {
        return { success: true, skipped: true, reason: 'staff_no_chat_push' }
      }

      return this.sendPush(profile.fcm_token, templateKey, data, profile.language || 'ru')
    } catch (error) {
      console.error('[FCM] Send to user error:', error.message)
      return { success: false, error: error.message }
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
  static async registerToken(userId, fcmToken) {
    try {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ 
          fcm_token: fcmToken,
          fcm_updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      console.log(`[FCM] Registered token for user ${userId}`);
      return { success: true };

    } catch (error) {
      console.error('[FCM] Register token error:', error.message);
      return { success: false, error: error.message };
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
      const result = await res.json()
      if (!res.ok) {
        console.warn('[FCM] Badge update failed:', result?.error?.message)
        return { success: false, error: result?.error?.message }
      }
      return { success: true, unreadCount }
    } catch (e) {
      console.warn('[FCM] sendSilentBadgeUpdate error:', e?.message)
      return { success: false, error: e?.message }
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
