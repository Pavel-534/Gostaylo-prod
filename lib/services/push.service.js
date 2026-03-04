/**
 * FunnyRent 2.1 - Firebase Push Notification Service
 * Server-side FCM integration for real-time alerts
 * 
 * Triggers:
 * - New chat messages (if user offline)
 * - Booking status changes
 * - Check-in confirmation reminders (14:00 on check-in day)
 * - Payment confirmations
 */

import { supabaseAdmin } from '@/lib/supabase';

// Firebase Admin SDK configuration
const FIREBASE_CONFIG = {
  type: "service_account",
  project_id: "funnyrent-push",
  private_key_id: "160e973d115781f5222f797e36c456ec02157aeb",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDD/qjNsgCdN8C6\n27d/rU6Tvb8Kpd44kfY76EbhDJXmUrVzbZkmJWvOBpqyGheWNrSMP1xFVOefCLAJ\nFalA3FBrB80DljDfDzL5klEflxxUdsBrFdEJwNjRCE5dL5aT39K/WJC2PmPLJDlX\ndkBwAR0SlduV5xriHdPRcy8DQXumoyqsfxhVSPBVjMjcizlaZN33j7BmKdhkc4tF\n3ev0GJZPm7elNQNYkiEf0e9MIqGYGGel49QX7PMqmApdEq2V4tkYLfDtnFIzcxhR\ngdMz6sLxHvx0kjp/IErP7RrIwkscOyoCAF6n1Vh6nlRKMnQXdJ5HGvclZzC/auvP\nNxYJ9/HBAgMBAAECggEACdl65zdqU3xRSbKwApEVkVQoTSMvyzz+mF0gbr/gqp3+\nc2oPF70qsURgstGf3NMr+J5Yhz1wlGvt2M8HXfSUcASI14TNOPB9GdCyFfnUmSQM\noHUMt8ZCvyKBOaqiERVe9HHBd/8jqbpMzWnqbBaKPPxd+CcQkUt5cR2uP6YjTijv\naE7w87zmPdVqaO103roSLiz6E2XahFamim1VdlFVlimxcIIgOhgk+H53KgmqL5ge\nucaBDBytViutJ5TFtueRk5occ0GVYa6BfiwHDz649mGAyVUmJYPgOnYqb+rgVjPZ\nH7ONYJH6PnT48TJBRHH66zFZ1mFz9pDuGt+0l0yFSQKBgQD1uYd7N0CJtNsEgS8a\n7nEQn6f7G2nYnC5Njto3CPqcqNxWIMQCzQ8qwrt8XvKpUn9irqIVCiJAouOaqJ4U\n0BVNJPWBmQa6k6EphahOLt8hbv7dp1Hb/bDg6p94+4KzxoLHWwIK9xvMqtXuA3aD\nX+drwk+xn/EbzEJs4NBaXbkodQKBgQDMMMYAopxl8utYXWQkAQCEm93lEOza9nee\nZ1AzVSey4SOatctOBgWyft2n3A+72z2pwlgvUv3suNQV6HY0wr/eLIfomQWgsq2U\nu8wN9O8Cs0C27g7bhQxAZrDwQzdo7LG21C3aHOVSafrkasj2dBBMMdYcxf4Uoy75\nDvwDnE1anQKBgFgq0LTiV1LRxMAyBg/YvFLlpmVQKcNiDq8fcabLnvh1ElIJAaur\niSOqKzweItOoYxr8pYwA6hDif0lQUtgejQq7bgpiyOI8wut/HzJDqC1bddkQNf5\nh+y74qqLPBN7R9N2ER6UGbJvHcGAFpb+409j8ipepCmAOdlNNRUnidc9AoGAOb+l\nkDJtNywfwWsQUlpyMg7/D7TcuASyyfsAJLR1uNKRxkSaDiQH4nac68eCL6gO5X8Q\nf7niFNwlJ1kKbVuS9hv0CCWXAN7n1sPSLzRRkJrvt4zWaOFVGLWyXxEzj5o5nLKf\nkStQ9CEDEyzcT099+H6zxol8lYudUlUZk0/WVMUCgYEA2USmBhjqG9uwWGrTp1YH\nT15Ckjmq0VIzjDfKcSf6B1C43O1QeCknGrD1afD2HszZVVMl829ke1sNyVrlCHax\nWdFHYZtXrjPxj85zNu0NxYMWgkAV1CEHHaDQ8oVE+ulX689sTPSoWgx5yAGzQG/u\nAy1yJceQXvFoVIvwQOylN4g=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@funnyrent-push.iam.gserviceaccount.com"
};

// FCM API URL
const FCM_URL = 'https://fcm.googleapis.com/v1/projects/funnyrent-push/messages:send';

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
  }
};

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

      const message = {
        message: {
          token: fcmToken,
          notification: {
            title,
            body
          },
          webpush: {
            notification: {
              icon: template.icon,
              badge: template.badge,
              tag: template.tag,
              requireInteraction: template.requireInteraction || false,
              actions: template.actions
            },
            fcm_options: {
              link: data.link || '/'
            }
          },
          data: {
            type: templateKey,
            ...Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, String(v)])
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
      // Get user's FCM token from profile
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('fcm_token, language')
        .eq('id', userId)
        .single();

      if (error || !profile?.fcm_token) {
        console.log(`[FCM] No token for user ${userId}`);
        return { success: false, error: 'No FCM token' };
      }

      return this.sendPush(profile.fcm_token, templateKey, data, profile.language || 'ru');

    } catch (error) {
      console.error('[FCM] Send to user error:', error.message);
      return { success: false, error: error.message };
    }
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
