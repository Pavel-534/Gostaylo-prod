/**
 * Stage 189.1 — Account linking SSOT (profiles ↔ OAuth / phone / Telegram).
 * Auto-merge by email only when provider asserts email_verified.
 */
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { normalizePhoneE164 } from '@/lib/auth/phone-otp.service'

export const LINKABLE_PROVIDERS = Object.freeze([
  'email',
  'phone',
  'telegram',
  'google',
  'apple',
  'yandex',
  'vk',
])

const CONFLICT_TTL_SEC = Number(process.env.AUTH_LINK_CONFLICT_TTL_SEC || 30 * 60)

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`
}

/**
 * @param {import('@supabase/supabase-js').User | null | undefined} authUser
 */
export function isAuthUserEmailVerified(authUser) {
  if (!authUser) return false
  if (authUser.email_confirmed_at) return true
  const meta = authUser.user_metadata || {}
  const app = authUser.app_metadata || {}
  const raw = meta.email_verified ?? meta.email_confirmed ?? app.email_verified
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true
  // Google / Apple often set identities[].identity_data.email_verified
  const identities = Array.isArray(authUser.identities) ? authUser.identities : []
  for (const id of identities) {
    const d = id?.identity_data || {}
    if (d.email_verified === true || d.email_verified === 'true') return true
  }
  return false
}

/**
 * @param {import('@supabase/supabase-js').User | null | undefined} authUser
 */
export function resolveOAuthProviderId(authUser) {
  const app = authUser?.app_metadata || {}
  const meta = authUser?.user_metadata || {}
  const fromApp = String(app.provider || '').toLowerCase().trim()
  if (LINKABLE_PROVIDERS.includes(fromApp) && fromApp !== 'email') return fromApp
  const identities = Array.isArray(authUser?.identities) ? authUser.identities : []
  const oauth = identities.find((i) => {
    const p = String(i?.provider || '').toLowerCase()
    return p && p !== 'email'
  })
  if (oauth?.provider) return String(oauth.provider).toLowerCase()
  const fromMeta = String(meta.provider || '').toLowerCase().trim()
  if (LINKABLE_PROVIDERS.includes(fromMeta)) return fromMeta
  return 'google'
}

/**
 * @param {string} profileId
 * @param {{ provider: string, providerSubject?: string|null, authUserId?: string|null, metadata?: Record<string, unknown> }} link
 */
export async function upsertProfileAuthIdentity(profileId, link) {
  if (!supabaseAdmin) return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED }
  const provider = String(link.provider || '').toLowerCase().trim()
  if (!LINKABLE_PROVIDERS.includes(provider)) {
    return { ok: false, error_code: 'AUTH_LINK_PROVIDER_INVALID' }
  }
  const id = makeId('pai')
  const row = {
    id,
    profile_id: profileId,
    provider,
    provider_subject: link.providerSubject ? String(link.providerSubject) : null,
    auth_user_id: link.authUserId ? String(link.authUserId) : null,
    metadata: link.metadata || {},
    linked_at: new Date().toISOString(),
  }

  const { data: existing } = await supabaseAdmin
    .from('profile_auth_identities')
    .select('id')
    .eq('profile_id', profileId)
    .eq('provider', provider)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from('profile_auth_identities')
      .update({
        provider_subject: row.provider_subject,
        auth_user_id: row.auth_user_id,
        metadata: row.metadata,
        linked_at: row.linked_at,
      })
      .eq('id', existing.id)
    if (error) {
      console.error('[account-linking] identity update', error.message)
      return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_ERROR }
    }
    return { ok: true, id: existing.id }
  }

  const { error } = await supabaseAdmin.from('profile_auth_identities').insert(row)
  if (error) {
    console.error('[account-linking] identity insert', error.message)
    return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_ERROR }
  }
  return { ok: true, id }
}

/**
 * When OAuth auth_user is already bound to another profile — open conflict UX.
 * @param {{
 *   provider: string,
 *   occupiedProfileId: string,
 *   challengerProfileId?: string|null,
 *   authUserId?: string|null,
 *   providerEmail?: string|null,
 *   providerSubject?: string|null,
 *   metadata?: Record<string, unknown>,
 * }} opts
 */
export async function createAuthLinkConflict(opts) {
  if (!supabaseAdmin) return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED }

  const token = crypto.randomBytes(24).toString('base64url')
  const id = makeId('alc')
  const expiresAt = new Date(Date.now() + CONFLICT_TTL_SEC * 1000).toISOString()

  const { error } = await supabaseAdmin.from('auth_link_conflicts').insert({
    id,
    token,
    provider: String(opts.provider || 'oauth').toLowerCase(),
    challenger_profile_id: opts.challengerProfileId || null,
    occupied_profile_id: opts.occupiedProfileId,
    auth_user_id: opts.authUserId || null,
    provider_email: opts.providerEmail || null,
    provider_subject: opts.providerSubject || null,
    status: 'pending',
    expires_at: expiresAt,
    metadata: opts.metadata || {},
  })

  if (error) {
    console.error('[account-linking] conflict insert', error.message)
    return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_ERROR }
  }

  return { ok: true, token, conflictId: id, expiresAt }
}

/**
 * @param {string} token
 */
export async function getAuthLinkConflictByToken(token) {
  if (!supabaseAdmin) return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED }
  const t = String(token || '').trim()
  if (!t) return { ok: false, error_code: 'AUTH_LINK_CONFLICT_NOT_FOUND' }

  const { data, error } = await supabaseAdmin
    .from('auth_link_conflicts')
    .select(
      '*, occupied:profiles!occupied_profile_id(id, email, phone, first_name, last_name, telegram_username)',
    )
    .eq('token', t)
    .maybeSingle()

  if (error || !data) return { ok: false, error_code: 'AUTH_LINK_CONFLICT_NOT_FOUND' }
  if (data.status !== 'pending') return { ok: false, error_code: 'AUTH_LINK_CONFLICT_RESOLVED' }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('auth_link_conflicts').update({ status: 'expired' }).eq('id', data.id)
    return { ok: false, error_code: 'AUTH_LINK_CONFLICT_EXPIRED' }
  }
  return { ok: true, conflict: data }
}

/**
 * @param {string} token
 * @param {'resolved_login' | 'resolved_merge' | 'cancelled'} status
 */
export async function resolveAuthLinkConflict(token, status) {
  if (!supabaseAdmin) return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED }
  const got = await getAuthLinkConflictByToken(token)
  if (!got.ok) return got

  const { error } = await supabaseAdmin
    .from('auth_link_conflicts')
    .update({ status, resolved_at: new Date().toISOString() })
    .eq('id', got.conflict.id)

  if (error) return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_ERROR }
  return { ok: true, conflict: got.conflict }
}

/**
 * Merge challenger profile into occupied (OAuth) profile after OTP proof on challenger's phone.
 * @param {string} token
 * @param {{ challengerProfileId: string, verifiedPhoneE164: string }} opts
 */
export async function mergeProfilesOnLinkConflict(token, opts) {
  if (!supabaseAdmin) return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED }

  const got = await getAuthLinkConflictByToken(token)
  if (!got.ok) return got

  const conflict = got.conflict
  const occupiedId = conflict.occupied_profile_id
  const challengerId = opts?.challengerProfileId || conflict.challenger_profile_id

  if (!challengerId || String(challengerId) === String(occupiedId)) {
    return { ok: false, error_code: 'AUTH_LINK_MERGE_NOT_ELIGIBLE' }
  }

  const { data: challenger } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', challengerId)
    .maybeSingle()
  const { data: occupied } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', occupiedId)
    .maybeSingle()

  if (!challenger || !occupied) {
    return { ok: false, error_code: AuthErrorCode.AUTH_PROFILE_NOT_FOUND }
  }

  const challengerPhone = normalizePhoneE164(challenger.phone || '')
  const verifiedPhone = normalizePhoneE164(opts?.verifiedPhoneE164 || '')
  if (!verifiedPhone || challengerPhone !== verifiedPhone) {
    return { ok: false, error_code: 'AUTH_LINK_VERIFY_FAILED' }
  }

  const patch = { updated_at: new Date().toISOString() }
  if (!occupied.phone && challenger.phone) patch.phone = challenger.phone
  if (!occupied.telegram_id && challenger.telegram_id) {
    patch.telegram_id = challenger.telegram_id
    patch.telegram_username = challenger.telegram_username
  }
  if (!occupied.first_name && challenger.first_name) patch.first_name = challenger.first_name
  if (!occupied.last_name && challenger.last_name) patch.last_name = challenger.last_name

  const { error: upErr } = await supabaseAdmin.from('profiles').update(patch).eq('id', occupiedId)
  if (upErr) {
    console.error('[account-linking] merge patch', upErr.message)
    return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_ERROR }
  }

  await upsertProfileAuthIdentity(occupiedId, {
    provider: conflict.provider,
    providerSubject: conflict.provider_subject || conflict.auth_user_id,
    authUserId: conflict.auth_user_id,
    metadata: { mergedFrom: challengerId, source: 'link_conflict_merge' },
  })

  if (challenger.phone) {
    await upsertProfileAuthIdentity(occupiedId, {
      provider: 'phone',
      providerSubject: challengerPhone,
      metadata: { mergedFrom: challengerId },
    })
  }

  await supabaseAdmin
    .from('profiles')
    .update({
      phone: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', challengerId)

  await resolveAuthLinkConflict(token, 'resolved_merge')

  return {
    ok: true,
    profile: { ...occupied, ...patch },
    mergedFromProfileId: challengerId,
  }
}

/**
 * @param {string} profileId
 */
export async function listProfileAuthIdentities(profileId) {
  if (!supabaseAdmin) return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED, identities: [] }
  const { data, error } = await supabaseAdmin
    .from('profile_auth_identities')
    .select('id, provider, provider_subject, auth_user_id, linked_at, metadata')
    .eq('profile_id', profileId)
    .order('linked_at', { ascending: true })

  if (error) {
    console.error('[account-linking] list', error.message)
    return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_ERROR, identities: [] }
  }
  return { ok: true, identities: data || [] }
}

/**
 * Unlink provider if at least one other method remains.
 * @param {string} profileId
 * @param {string} provider
 * @param {{ hasPassword?: boolean, hasPhone?: boolean, hasTelegram?: boolean }} fallbacks
 */
export async function unlinkProfileAuthIdentity(profileId, provider, fallbacks = {}) {
  if (!supabaseAdmin) return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED }
  const p = String(provider || '').toLowerCase()
  const listed = await listProfileAuthIdentities(profileId)
  if (!listed.ok) return listed

  const linked = new Set((listed.identities || []).map((i) => i.provider))
  if (fallbacks.hasPassword) linked.add('email')
  if (fallbacks.hasPhone) linked.add('phone')
  if (fallbacks.hasTelegram) linked.add('telegram')

  if (!linked.has(p)) return { ok: false, error_code: 'AUTH_LINK_NOT_CONNECTED' }
  if (linked.size <= 1) return { ok: false, error_code: 'AUTH_LINK_LAST_METHOD' }

  const { error } = await supabaseAdmin
    .from('profile_auth_identities')
    .delete()
    .eq('profile_id', profileId)
    .eq('provider', p)

  if (error) return { ok: false, error_code: AuthErrorCode.AUTH_DATABASE_ERROR }
  return { ok: true }
}

/**
 * Build connection status map for AccountConnections UI.
 * @param {Record<string, unknown>} profile
 * @param {Array<{ provider: string }>} identities
 * @param {{ isRussia?: boolean }} geo
 */
export function buildAccountConnectionStates(profile, identities = [], geo = {}) {
  const linked = new Set(identities.map((i) => String(i.provider).toLowerCase()))
  if (profile?.email && !String(profile.email).includes('.airento.invalid')) linked.add('email')
  if (profile?.password_hash) linked.add('email')
  if (profile?.phone) linked.add('phone')
  if (profile?.telegram_id) linked.add('telegram')

  const isRussia = Boolean(geo.isRussia)
  const all = ['email', 'phone', 'telegram', 'yandex', 'vk', 'google', 'apple']

  return all.map((provider) => {
    const foreign = provider === 'google' || provider === 'apple'
    return {
      provider,
      connected: linked.has(provider),
      available: !(foreign && isRussia),
      canUnlink: linked.has(provider) && linked.size > 1,
    }
  })
}
