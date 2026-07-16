/**
 * Stage 189.2 — Dual-route SMS dispatch SSOT (RU: SMSC.ru, intl: Twilio).
 * Mock only in development / E2E — never burns provider balance in prod by accident.
 */
import { getSiteDisplayName } from '@/lib/site-url'
import { normalizePhoneE164 } from '@/lib/auth/phone-e164'

const SMSC_SEND_URL = 'https://smsc.ru/sys/send.php'

/** @typedef {'smsc' | 'twilio'} SmsProviderId */

/**
 * @param {string} phoneE164
 */
export function maskPhoneE164(phoneE164) {
  const raw = String(phoneE164 || '').trim()
  if (!raw) return '(empty)'
  if (raw.length <= 6) return '***'
  return `${raw.slice(0, 3)}***${raw.slice(-2)}`
}

/**
 * @param {string} phoneE164
 * @returns {SmsProviderId}
 */
export function resolveSmsProvider(phoneE164) {
  const phone = normalizePhoneE164(phoneE164)
  if (phone.startsWith('+7')) return 'smsc'
  return 'twilio'
}

export function isSmsDeliveryMocked() {
  if (process.env.E2E_TEST_RUN === '1' || process.env.SMOKE_FINANCIAL_RUN === '1') {
    return true
  }
  if (process.env.AUTH_PHONE_OTP_MOCK === '1') {
    return process.env.NODE_ENV !== 'production'
  }
  return false
}

function smscConfigured() {
  return Boolean(
    String(process.env.SMSC_LOGIN || '').trim() && String(process.env.SMSC_PASSWORD || '').trim(),
  )
}

function twilioConfigured() {
  return Boolean(
    String(process.env.TWILIO_ACCOUNT_SID || '').trim() &&
      String(process.env.TWILIO_AUTH_TOKEN || '').trim() &&
      String(process.env.TWILIO_FROM_NUMBER || '').trim(),
  )
}

/**
 * @param {SmsProviderId} provider
 */
function isProviderConfigured(provider) {
  return provider === 'smsc' ? smscConfigured() : twilioConfigured()
}

/**
 * @param {string} phoneE164
 */
function toSmscPhonesParam(phoneE164) {
  return normalizePhoneE164(phoneE164).replace(/\D/g, '')
}

/**
 * @param {string} phoneE164
 * @param {string} code
 */
export function buildAuthOtpSmsBody(phoneE164, code) {
  const brand = getSiteDisplayName()
  const otp = String(code || '').trim()
  if (normalizePhoneE164(phoneE164).startsWith('+7')) {
    return `${brand}: код подтверждения ${otp}. Никому не сообщайте.`
  }
  return `${brand}: your verification code is ${otp}. Do not share it.`
}

/**
 * @param {{ phoneE164: string, body: string, context?: string }} opts
 * @returns {Promise<{ ok: true, provider: SmsProviderId, mocked?: boolean } | { ok: false, error_code: string, provider?: SmsProviderId }>}
 */
export async function dispatchSms({ phoneE164, body, context = 'generic' }) {
  const phone = normalizePhoneE164(phoneE164)
  if (!phone || phone.length < 11) {
    return { ok: false, error_code: 'AUTH_PHONE_INVALID' }
  }

  const text = String(body || '').trim()
  if (!text) {
    return { ok: false, error_code: 'AUTH_SMS_DELIVERY_FAILED' }
  }

  if (isSmsDeliveryMocked()) {
    console.log('[sms-dispatch] mock', {
      context,
      provider: resolveSmsProvider(phone),
      phone: maskPhoneE164(phone),
      bodyLength: text.length,
    })
    return { ok: true, provider: resolveSmsProvider(phone), mocked: true }
  }

  const provider = resolveSmsProvider(phone)
  if (!isProviderConfigured(provider)) {
    console.error('[sms-dispatch] provider not configured', {
      context,
      provider,
      phone: maskPhoneE164(phone),
    })
    return { ok: false, error_code: 'AUTH_PHONE_SMS_NOT_CONFIGURED', provider }
  }

  try {
    if (provider === 'smsc') {
      return await sendViaSmsc({ phone, body: text, context })
    }
    return await sendViaTwilio({ phone, body: text, context })
  } catch (error) {
    console.error('[sms-dispatch] unexpected failure', {
      context,
      provider,
      phone: maskPhoneE164(phone),
      message: error?.message || String(error),
    })
    return { ok: false, error_code: 'AUTH_SMS_DELIVERY_FAILED', provider }
  }
}

/**
 * @param {string} phoneE164
 * @param {string} code
 */
export async function dispatchAuthOtpSms(phoneE164, code) {
  return dispatchSms({
    phoneE164,
    body: buildAuthOtpSmsBody(phoneE164, code),
    context: 'auth_otp',
  })
}

/**
 * @param {{ phone: string, body: string, context: string }} opts
 */
async function sendViaSmsc({ phone, body, context }) {
  const login = String(process.env.SMSC_LOGIN || '').trim()
  const password = String(process.env.SMSC_PASSWORD || '').trim()
  const sender = String(process.env.SMSC_SENDER || '').trim()

  const params = new URLSearchParams({
    login,
    psw: password,
    phones: toSmscPhonesParam(phone),
    mes: body,
    fmt: '3',
    charset: 'utf-8',
  })
  if (sender) params.set('sender', sender)

  const res = await fetch(`${SMSC_SEND_URL}?${params.toString()}`, {
    method: 'GET',
    signal: AbortSignal.timeout(15000),
  })

  const payload = await res.json().catch(() => null)
  const providerError =
    payload?.error ||
    payload?.error_code ||
    (Array.isArray(payload) && payload[0]?.error) ||
    null

  if (!res.ok || providerError) {
    console.error('[sms-dispatch] SMSC delivery failed', {
      context,
      phone: maskPhoneE164(phone),
      httpStatus: res.status,
      providerError: providerError || 'unknown',
      balance: payload?.balance ?? payload?.[0]?.balance ?? undefined,
    })
    return { ok: false, error_code: 'AUTH_SMS_DELIVERY_FAILED', provider: 'smsc' }
  }

  console.log('[sms-dispatch] SMSC accepted', {
    context,
    phone: maskPhoneE164(phone),
    id: payload?.id ?? payload?.[0]?.id ?? null,
  })
  return { ok: true, provider: 'smsc' }
}

/**
 * @param {{ phone: string, body: string, context: string }} opts
 */
async function sendViaTwilio({ phone, body, context }) {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim()
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim()
  const from = String(process.env.TWILIO_FROM_NUMBER || '').trim()

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const form = new URLSearchParams({
    To: phone,
    From: from,
    Body: body,
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
    signal: AbortSignal.timeout(15000),
  })

  const payload = await res.json().catch(() => ({}))
  const providerError = payload?.message || payload?.error_message || null

  if (!res.ok || providerError) {
    console.error('[sms-dispatch] Twilio delivery failed', {
      context,
      phone: maskPhoneE164(phone),
      httpStatus: res.status,
      providerError: providerError || 'unknown',
      code: payload?.code ?? null,
    })
    return { ok: false, error_code: 'AUTH_SMS_DELIVERY_FAILED', provider: 'twilio' }
  }

  console.log('[sms-dispatch] Twilio accepted', {
    context,
    phone: maskPhoneE164(phone),
    sid: payload?.sid ?? null,
    status: payload?.status ?? null,
  })
  return { ok: true, provider: 'twilio' }
}
