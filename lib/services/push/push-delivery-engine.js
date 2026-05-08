import { buildFcmTemplateEnvelope, parseFcmHttpError } from '@/lib/services/push/fcm-http-delivery.js'
import {
  buildRenderedPushNotification,
  buildPushDataStrings,
  buildSilentBadgeFcmPayload,
} from '@/lib/services/push/push-templates.js'
import {
  getFcmAccessToken,
  deliverFcmNotification,
  scheduleBackgroundWork,
  signJwt as transportSignJwt,
  base64UrlEncode as transportBase64UrlEncode,
} from '@/lib/services/push/push-transport.js'

export { parseFcmHttpError, getFcmAccessToken, scheduleBackgroundWork }

export async function signJwt(header, payload, privateKey) {
  return transportSignJwt(header, payload, privateKey)
}

export function base64UrlEncode(str) {
  return transportBase64UrlEncode(str)
}

export async function sendPush(fcmToken, templateKey, data = {}, lang = 'ru', logContext = {}) {
  if (!fcmToken) return { success: false, error: 'No FCM token' }
  const traceUid = logContext?.profileId ?? '?'

  const rendered = buildRenderedPushNotification(templateKey, data, lang)
  if (!rendered.ok) return { success: false, error: rendered.error }

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

export async function sendSilentBadgeUpdate(fcmToken, unreadCount) {
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
