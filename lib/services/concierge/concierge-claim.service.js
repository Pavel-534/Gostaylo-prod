/**
 * ADR-210 Slice 3 — Concierge Magic Claim (invite + activate shadow PARTNER).
 * Greenfield only: target profile must remain is_shadow until claim succeeds.
 * No foreign OAuth. RU requires verified phone OTP (existing phone-otp SSOT).
 */

import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url'
import { sendResendEmail } from '@/lib/services/notifications/email.service.js'
import { isAuthPasswordCompliant } from '@/lib/auth/password-policy'
import {
  normalizePhoneE164,
  verifyPhoneOtpChallenge,
} from '@/lib/auth/phone-otp.service'
import { normalizeConciergeEmail } from '@/lib/services/concierge/concierge-supply.service.js'

export function hashClaimToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || ''), 'utf8').digest('hex')
}

export function generateClaimRawToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function buildClaimUrl(rawToken) {
  const base = getPublicSiteUrl().replace(/\/$/, '')
  return `${base}/claim?token=${encodeURIComponent(String(rawToken || ''))}`
}

/**
 * Verify OTP using challengeId when provided; otherwise latest open challenge for phone.
 * @param {{ phone: string, code: string, challengeId?: string, db?: import('@supabase/supabase-js').SupabaseClient }}
 */
export async function verifyClaimPhoneOtp({ phone, code, challengeId, db }) {
  const phoneE164 = normalizePhoneE164(phone)
  if (!phoneE164) {
    return { ok: false, code: 'AUTH_PHONE_INVALID', error: 'Valid phone required' }
  }

  let id = String(challengeId || '').trim()
  if (!id) {
    const client = db || supabaseAdmin
    if (!client) {
      return { ok: false, code: 'AUTH_DATABASE_NOT_CONFIGURED', error: 'Database not configured' }
    }
    const { data: rows, error } = await client
      .from('auth_phone_otp_challenges')
      .select('id')
      .eq('phone_e164', phoneE164)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) {
      return { ok: false, code: 'AUTH_DATABASE_ERROR', error: error.message }
    }
    id = Array.isArray(rows) && rows[0]?.id ? String(rows[0].id) : ''
  }

  if (!id) {
    return {
      ok: false,
      code: 'PHONE_OTP_REQUIRED',
      error: 'Send phone OTP first (POST /api/v2/auth/phone/send), then submit code',
    }
  }

  const verified = await verifyPhoneOtpChallenge(id, code)
  if (!verified.ok) {
    return {
      ok: false,
      code: verified.error_code || 'AUTH_PHONE_OTP_INVALID',
      error: 'Phone OTP verification failed',
    }
  }

  if (verified.phoneE164 !== phoneE164) {
    return { ok: false, code: 'AUTH_PHONE_OTP_INVALID', error: 'OTP phone mismatch' }
  }

  return { ok: true, phoneE164: verified.phoneE164 }
}

/**
 * @param {{
 *   partnerProfileId: string,
 *   email: string,
 *   batchId?: string|null,
 *   expiresInDays?: number,
 *   createdByAdminId?: string|null,
 *   db?: import('@supabase/supabase-js').SupabaseClient,
 *   sendEmail?: boolean,
 * }} input
 */
export async function createPartnerClaimInvite(input) {
  const db = input.db || supabaseAdmin
  if (!db) {
    return { ok: false, status: 503, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured' }
  }

  const partnerProfileId = String(input.partnerProfileId || '').trim()
  const email = normalizeConciergeEmail(input.email)
  const batchId = input.batchId ? String(input.batchId).trim() : null
  const expiresInDays = Math.min(
    90,
    Math.max(1, Number.isFinite(Number(input.expiresInDays)) ? Number(input.expiresInDays) : 14),
  )

  if (!partnerProfileId) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', error: 'partnerProfileId required' }
  }
  if (!email || !email.includes('@')) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', error: 'Valid email required' }
  }

  const { data: partner, error: partnerErr } = await db
    .from('profiles')
    .select('id, email, role, is_shadow')
    .eq('id', partnerProfileId)
    .maybeSingle()

  if (partnerErr) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: partnerErr.message }
  }
  if (!partner?.id) {
    return { ok: false, status: 404, code: 'PARTNER_NOT_FOUND', error: 'Partner profile not found' }
  }
  if (partner.is_shadow !== true) {
    return {
      ok: false,
      status: 400,
      code: 'NOT_SHADOW_PROFILE',
      error: 'Claim invites require is_shadow=true (use ingest for existing partners)',
    }
  }

  const { data: liveCollision } = await db
    .from('profiles')
    .select('id, is_shadow')
    .eq('email', email)
    .maybeSingle()

  if (liveCollision?.id && liveCollision.id !== partnerProfileId && liveCollision.is_shadow !== true) {
    return {
      ok: false,
      status: 409,
      code: 'EMAIL_ALREADY_REGISTERED',
      error: 'A non-shadow profile already owns this email',
      profileId: liveCollision.id,
    }
  }

  if (batchId) {
    const { data: batch, error: batchErr } = await db
      .from('concierge_import_batches')
      .select('id, partner_profile_id')
      .eq('id', batchId)
      .maybeSingle()
    if (batchErr) {
      return { ok: false, status: 500, code: 'DB_ERROR', error: batchErr.message }
    }
    if (!batch?.id) {
      return { ok: false, status: 404, code: 'BATCH_NOT_FOUND', error: 'Import batch not found' }
    }
    if (String(batch.partner_profile_id) !== partnerProfileId) {
      return {
        ok: false,
        status: 400,
        code: 'BATCH_PARTNER_MISMATCH',
        error: 'batchId does not belong to partnerProfileId',
      }
    }
  }

  const rawToken = generateClaimRawToken()
  const tokenHash = hashClaimToken(rawToken)
  const inviteId = makeId('invite')
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
  const claimUrl = buildClaimUrl(rawToken)

  const { error: insertErr } = await db.from('partner_claim_invites').insert({
    id: inviteId,
    batch_id: batchId,
    partner_profile_id: partnerProfileId,
    token_hash: tokenHash,
    email,
    expires_at: expiresAt,
    claimed_at: null,
    claimed_by_profile_id: null,
    created_by_admin_id: input.createdByAdminId || null,
    created_at: new Date().toISOString(),
    metadata: { stage: '210.3' },
  })

  if (insertErr) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: insertErr.message || 'Invite create failed' }
  }

  if (input.sendEmail !== false) {
    const brand = getSiteDisplayName()
    const subject = `${brand}: активируйте кабинет партнёра`
    const text = [
      `Здравствуйте!`,
      ``,
      `Мы подготовили объявления в вашем кабинете ${brand}.`,
      `Откройте ссылку, задайте пароль и подтвердите телефон (для России — обязательно):`,
      claimUrl,
      ``,
      `Ссылка действует до ${expiresAt}.`,
      `После входа вы сможете проверить черновики. Выплаты откроются после отдельной верификации.`,
      ``,
      `— Команда ${brand}`,
    ].join('\n')
    await sendResendEmail(email, subject, text)
  }

  return {
    ok: true,
    status: 201,
    inviteId,
    expiresAt,
    claimUrl,
    // rawToken only for tests / ops dry-run when sendEmail=false — never log in prod handlers
    rawToken: input.sendEmail === false ? rawToken : undefined,
  }
}

/**
 * @param {{
 *   token: string,
 *   password: string,
 *   phone?: string,
 *   phoneOtpCode?: string,
 *   phoneChallengeId?: string,
 *   isRussia?: boolean,
 *   db?: import('@supabase/supabase-js').SupabaseClient,
 *   verifyOtpFn?: typeof verifyClaimPhoneOtp,
 * }} input
 */
export async function claimPartnerAccount(input) {
  const db = input.db || supabaseAdmin
  if (!db) {
    return { ok: false, status: 503, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured' }
  }

  const rawToken = String(input.token || '').trim()
  const password = String(input.password || '')
  if (!rawToken) {
    return { ok: false, status: 400, code: 'INVALID_OR_EXPIRED_TOKEN', error: 'token required' }
  }
  if (!isAuthPasswordCompliant(password)) {
    return {
      ok: false,
      status: 400,
      code: 'AUTH_PASSWORD_REQUIREMENTS',
      error: 'Password does not meet policy (min 8, letter + digit)',
    }
  }

  const tokenHash = hashClaimToken(rawToken)
  const nowIso = new Date().toISOString()

  const { data: invite, error: inviteErr } = await db
    .from('partner_claim_invites')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('claimed_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle()

  if (inviteErr) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: inviteErr.message }
  }
  if (!invite?.id) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_OR_EXPIRED_TOKEN',
      error: 'Invalid or expired claim token',
    }
  }

  const { data: partner, error: partnerErr } = await db
    .from('profiles')
    .select('*')
    .eq('id', invite.partner_profile_id)
    .maybeSingle()

  if (partnerErr) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: partnerErr.message }
  }
  if (!partner?.id) {
    return { ok: false, status: 404, code: 'PARTNER_NOT_FOUND', error: 'Shadow partner not found' }
  }
  if (partner.is_shadow !== true) {
    return {
      ok: false,
      status: 400,
      code: 'ALREADY_CLAIMED',
      error: 'Profile is no longer a shadow account',
    }
  }

  const inviteEmail = normalizeConciergeEmail(invite.email)
  const { data: emailOwner } = await db
    .from('profiles')
    .select('id, is_shadow')
    .eq('email', inviteEmail)
    .maybeSingle()

  if (
    emailOwner?.id &&
    emailOwner.id !== partner.id &&
    emailOwner.is_shadow !== true
  ) {
    return {
      ok: false,
      status: 409,
      code: 'EMAIL_ALREADY_REGISTERED',
      error: 'A non-shadow profile already owns this email',
      profileId: emailOwner.id,
    }
  }

  const russia = input.isRussia === true
  const runOtp = input.verifyOtpFn || verifyClaimPhoneOtp
  let phoneE164 = null

  if (russia) {
    const otp = await runOtp({
      phone: input.phone,
      code: input.phoneOtpCode,
      challengeId: input.phoneChallengeId,
      db,
    })
    if (!otp.ok) {
      return {
        ok: false,
        status: 400,
        code: otp.code || 'PHONE_OTP_REQUIRED',
        error: otp.error || 'Phone OTP required for Russia',
      }
    }
    phoneE164 = otp.phoneE164
  } else if (input.phone) {
    phoneE164 = normalizePhoneE164(input.phone)
    if (!phoneE164) {
      return { ok: false, status: 400, code: 'AUTH_PHONE_INVALID', error: 'Invalid phone' }
    }
    if (input.phoneOtpCode) {
      const otp = await runOtp({
        phone: input.phone,
        code: input.phoneOtpCode,
        challengeId: input.phoneChallengeId,
        db,
      })
      if (!otp.ok) {
        return { ok: false, status: 400, code: otp.code, error: otp.error }
      }
      phoneE164 = otp.phoneE164
    }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const updatePayload = {
    password_hash: passwordHash,
    is_shadow: false,
    shadow_claimed_at: nowIso,
    updated_at: nowIso,
    // Explicit: do NOT set is_verified true — payout KYC remains separate
  }
  if (phoneE164) {
    updatePayload.phone = phoneE164
  }

  const { data: updated, error: updErr } = await db
    .from('profiles')
    .update(updatePayload)
    .eq('id', partner.id)
    .eq('is_shadow', true)
    .select(
      'id, email, role, first_name, last_name, phone, avatar, referral_code, is_verified, preferred_currency, preferred_payout_currency, telegram_id, telegram_username, terms_accepted, terms_accepted_at, legal_terms_accepted_at, is_shadow, shadow_claimed_at',
    )
    .maybeSingle()

  if (updErr) {
    return { ok: false, status: 500, code: 'DB_ERROR', error: updErr.message }
  }
  if (!updated?.id) {
    return {
      ok: false,
      status: 409,
      code: 'ALREADY_CLAIMED',
      error: 'Shadow claim race: profile already activated',
    }
  }

  const { error: claimMarkErr } = await db
    .from('partner_claim_invites')
    .update({
      claimed_at: nowIso,
      claimed_by_profile_id: updated.id,
      metadata: {
        ...(invite.metadata && typeof invite.metadata === 'object' ? invite.metadata : {}),
        claimed_via: 'claim-partner',
        russia_otp: russia,
      },
    })
    .eq('id', invite.id)
    .is('claimed_at', null)

  if (claimMarkErr) {
    console.warn('[concierge-claim] invite mark failed', claimMarkErr.message)
  }

  return {
    ok: true,
    status: 200,
    profile: updated,
    profileId: updated.id,
    redirectTo: '/partner/listings?concierge_welcome=true',
  }
}
