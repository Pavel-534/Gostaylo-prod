/**
 * Stage 189.0 — Issue app session after phone / Telegram alternate auth.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { getJwtSecret } from '@/lib/auth/jwt-secret'
import {
  attachGostayloSessionCookie,
  profileRowToAuthUser,
  signJwtForProfile,
} from '@/lib/auth/app-session-issue'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { normalizePhoneE164 } from '@/lib/auth/phone-otp.service'
import { upsertProfileAuthIdentity } from '@/lib/auth/account-linking.service'

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function makeReferralCode(profileId) {
  const clean = String(profileId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase()
  return `AIR-${clean || Math.floor(100000 + Math.random() * 900000)}`
}

function phoneToSyntheticEmail(phoneE164) {
  const digits = String(phoneE164 || '').replace(/\D/g, '')
  return `phone+${digits}@phone.airento.invalid`
}

function telegramToSyntheticEmail(telegramId) {
  return `tg${String(telegramId).replace(/\D/g, '')}@telegram.airento.invalid`
}

/**
 * @param {string} phoneE164
 * @param {{ acceptedLegalTerms?: boolean }} [opts]
 */
export async function resolveProfileByVerifiedPhone(phoneE164, opts = {}) {
  if (!supabaseAdmin) return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED }

  const phone = normalizePhoneE164(phoneE164)
  if (!phone) return { ok: false, error_code: 'AUTH_PHONE_INVALID' }

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()

  if (existing) {
    if (existing.is_banned === true) {
      return { ok: false, error_code: AuthErrorCode.AUTH_ACCOUNT_SUSPENDED }
    }
    await upsertProfileAuthIdentity(existing.id, {
      provider: 'phone',
      providerSubject: phone,
      metadata: { source: 'phone_otp_login' },
    })
    return { ok: true, profile: existing, created: false }
  }

  const id = makeId('user')
  const email = phoneToSyntheticEmail(phone)
  const now = new Date().toISOString()
  const legalAccepted = opts.acceptedLegalTerms === true

  const insertRow = {
    id,
    email,
    phone,
    role: 'RENTER',
    first_name: '',
    last_name: null,
    referral_code: makeReferralCode(id),
    is_verified: true,
    password_hash: null,
    created_at: now,
    updated_at: now,
    ...(legalAccepted ? { legal_terms_accepted_at: now } : {}),
  }

  const { data: created, error } = await supabaseAdmin.from('profiles').insert(insertRow).select('*').single()
  if (error) {
    if (error.code === '23505') {
      const { data: race } = await supabaseAdmin.from('profiles').select('*').eq('phone', phone).maybeSingle()
      if (race) return { ok: true, profile: race, created: false }
    }
    console.error('[alternate-auth] phone profile insert', error.message)
    return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_ERROR }
  }

  await upsertProfileAuthIdentity(created.id, {
    provider: 'phone',
    providerSubject: phone,
    metadata: { source: 'phone_otp_register' },
  })

  return { ok: true, profile: created, created: true }
}

/**
 * @param {Record<string, string>} telegramData — verified widget payload
 * @param {{ acceptedLegalTerms?: boolean }} [opts]
 */
export async function resolveProfileByTelegramLogin(telegramData, opts = {}) {
  if (!supabaseAdmin) return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED }

  const telegramId = String(telegramData.id || '').trim()
  if (!telegramId) return { ok: false, error_code: 'AUTH_TELEGRAM_INVALID' }

  const username = telegramData.username ? String(telegramData.username).trim() : null
  const firstName = telegramData.first_name ? String(telegramData.first_name).trim() : ''
  const lastName = telegramData.last_name ? String(telegramData.last_name).trim() : null

  const { data: byTg } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (byTg) {
    if (byTg.is_banned === true) {
      return { ok: false, error_code: AuthErrorCode.AUTH_ACCOUNT_SUSPENDED }
    }
    const patch = {
      telegram_username: username,
      updated_at: new Date().toISOString(),
      ...(firstName && !byTg.first_name ? { first_name: firstName } : {}),
      ...(lastName && !byTg.last_name ? { last_name: lastName } : {}),
      is_verified: true,
    }
    await supabaseAdmin.from('profiles').update(patch).eq('id', byTg.id)
    await upsertProfileAuthIdentity(byTg.id, {
      provider: 'telegram',
      providerSubject: telegramId,
      metadata: { username, source: 'telegram_login' },
    })
    return { ok: true, profile: { ...byTg, ...patch }, created: false }
  }

  const id = makeId('user')
  const email = telegramToSyntheticEmail(telegramId)
  const now = new Date().toISOString()
  const legalAccepted = opts.acceptedLegalTerms === true

  const insertRow = {
    id,
    email,
    role: 'RENTER',
    first_name: firstName,
    last_name: lastName,
    telegram_id: telegramId,
    telegram_username: username,
    referral_code: makeReferralCode(id),
    is_verified: true,
    password_hash: null,
    created_at: now,
    updated_at: now,
    ...(legalAccepted ? { legal_terms_accepted_at: now } : {}),
  }

  const { data: created, error } = await supabaseAdmin.from('profiles').insert(insertRow).select('*').single()
  if (error) {
    if (error.code === '23505') {
      const { data: race } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle()
      if (race) return { ok: true, profile: race, created: false }
    }
    console.error('[alternate-auth] telegram profile insert', error.message)
    return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_ERROR }
  }

  await upsertProfileAuthIdentity(created.id, {
    provider: 'telegram',
    providerSubject: telegramId,
    metadata: { username, source: 'telegram_register' },
  })

  return { ok: true, profile: created, created: true }
}

/**
 * @param {import('next/server').NextResponse} response
 * @param {Record<string, unknown>} profileRow
 */
export function attachSessionForProfile(response, profileRow) {
  const jwtSecret = getJwtSecret()
  const token = signJwtForProfile(profileRow, jwtSecret)
  attachGostayloSessionCookie(response, token)
  return {
    token,
    user: profileRowToAuthUser(profileRow),
  }
}
