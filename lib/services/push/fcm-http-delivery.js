/**
 * Stage 52.0 — HTTP v1 доставка в FCM (тело сообщения + POST).
 */

/**
 * @param {string} rawText
 * @param {number} [responseHttpStatus]
 */
export function parseFcmHttpError(rawText, responseHttpStatus = 0) {
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
  const raw = String(rawText || '')
  const httpStatus = parsed?.error?.status
  const stale =
    responseHttpStatus === 404 ||
    errorCode === 'UNREGISTERED' ||
    httpStatus === 'NOT_FOUND' ||
    /registration-token-not-registered|UNREGISTERED|requested entity was not found|not a valid FCM registration token|NOT_FOUND|unregistered/i.test(
      msg + raw,
    )
  return { message: msg, stale }
}

/**
 * @param {{
 *   fcmToken: string,
 *   templateKey: string,
 *   title: string,
 *   body: string,
 *   dataStrings: Record<string, string>,
 *   silent: boolean,
 * }} args
 */
export function buildFcmTemplateEnvelope({ fcmToken, templateKey, title, body, dataStrings, silent }) {
  const message = {
    message: {
      token: fcmToken,
      webpush: {
        headers: {
          Urgency: silent ? 'very-low' : 'high',
        },
        fcm_options: {
          link: dataStrings.link || '',
        },
      },
      data: {
        type: templateKey,
        _title: title,
        _body: body,
        ...dataStrings,
      },
    },
  }

  if (silent) {
    message.message.android = { priority: 'normal' }
    message.message.apns = {
      headers: { 'apns-priority': '5' },
      payload: { aps: { 'content-available': 1 } },
    }
  } else {
    message.message.notification = { title, body }
    message.message.webpush.notification = { title, body }
    message.message.android = {
      priority: 'high',
      ttl: '2419200s',
    }
    message.message.apns = {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
        },
      },
    }
  }

  return message
}

/**
 * @param {string} fcmUrl
 * @param {string} bearerToken
 * @param {object} jsonBody — полное тело `{ message: { ... } }`
 * @returns {Promise<{ ok: boolean, status: number, rawText: string }>}
 */
export async function postFcmV1Message(fcmUrl, bearerToken, jsonBody) {
  const response = await fetch(fcmUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jsonBody),
  })
  const rawText = await response.text()
  return { ok: response.ok, status: response.status, rawText }
}
