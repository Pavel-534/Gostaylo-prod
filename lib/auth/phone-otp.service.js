/**
 * Stage 189.0 — Phone OTP challenges (service_role SSOT).
 */
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { dispatchAuthOtpSms, isSmsDeliveryMocked } from '@/lib/auth/sms-dispatch.service'
import { normalizePhoneE164 } from '@/lib/auth/phone-e164'

export { normalizePhoneE164 } from '@/lib/auth/phone-e164'

const OTP_TTL_SEC = Number(process.env.AUTH_PHONE_OTP_TTL_SEC || 300)
const OTP_MAX_ATTEMPTS = 5
const OTP_RESEND_COOLDOWN_SEC = 60

function makeChallengeId() {
  return `otp-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * @param {string} phoneE164
 * @returns {Promise<{ ok: true, challengeId: string, mockCode?: string } | { ok: false, error_code: string }>}
 */
export async function createPhoneOtpChallenge(phoneE164) {
  if (!supabaseAdmin) return { ok: false, error_code: 'AUTH_DATABASE_NOT_CONFIGURED' }

  const phone = normalizePhoneE164(phoneE164)
  if (!phone || phone.length < 11) return { ok: false, error_code: 'AUTH_PHONE_INVALID' }

  const since = new Date(Date.now() - OTP_RESEND_COOLDOWN_SEC * 1000).toISOString()
  const { data: recent } = await supabaseAdmin
    .from('auth_phone_otp_challenges')
    .select('id')
    .eq('phone_e164', phone)
    .gte('created_at', since)
    .limit(1)

  if (Array.isArray(recent) && recent.length > 0) {
    return { ok: false, error_code: 'AUTH_PHONE_OTP_COOLDOWN' }
  }

  const code = generateOtpCode()
  const codeHash = await bcrypt.hash(code, 10)
  const challengeId = makeChallengeId()
  const expiresAt = new Date(Date.now() + OTP_TTL_SEC * 1000).toISOString()

  const { error } = await supabaseAdmin.from('auth_phone_otp_challenges').insert({
    id: challengeId,
    phone_e164: phone,
    code_hash: codeHash,
    attempts: 0,
    expires_at: expiresAt,
  })

  if (error) {
    console.error('[phone-otp] insert failed', error.message)
    return { ok: false, error_code: 'AUTH_DATABASE_ERROR' }
  }

  const sent = await dispatchAuthOtpSms(phone, code)
  if (!sent.ok) {
    await supabaseAdmin.from('auth_phone_otp_challenges').delete().eq('id', challengeId)
    return { ok: false, error_code: sent.error_code || 'AUTH_SMS_DELIVERY_FAILED' }
  }

  const mock = isSmsDeliveryMocked() ? code : undefined

  return { ok: true, challengeId, mockCode: mock }
}

/**
 * @param {string} challengeId
 * @param {string} code
 */
export async function verifyPhoneOtpChallenge(challengeId, code) {
  if (!supabaseAdmin) return { ok: false, error_code: 'AUTH_DATABASE_NOT_CONFIGURED' }

  const id = String(challengeId || '').trim()
  const otp = String(code || '').replace(/\D/g, '')
  if (!id || otp.length !== 6) return { ok: false, error_code: 'AUTH_PHONE_OTP_INVALID' }

  const { data: row, error } = await supabaseAdmin
    .from('auth_phone_otp_challenges')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !row) return { ok: false, error_code: 'AUTH_PHONE_OTP_EXPIRED' }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('auth_phone_otp_challenges').delete().eq('id', id)
    return { ok: false, error_code: 'AUTH_PHONE_OTP_EXPIRED' }
  }

  if (Number(row.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error_code: 'AUTH_PHONE_OTP_MAX_ATTEMPTS' }
  }

  const match = await bcrypt.compare(otp, row.code_hash)
  if (!match) {
    await supabaseAdmin
      .from('auth_phone_otp_challenges')
      .update({ attempts: Number(row.attempts || 0) + 1 })
      .eq('id', id)
    return { ok: false, error_code: 'AUTH_PHONE_OTP_WRONG' }
  }

  await supabaseAdmin.from('auth_phone_otp_challenges').delete().eq('id', id)
  return { ok: true, phoneE164: row.phone_e164 }
}
