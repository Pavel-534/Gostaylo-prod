/**
 * Stage 131.3 — vanity referral links (`/go/phuket-pasha`).
 */
import { supabaseAdmin } from '@/lib/supabase'

const VANITY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizeVanityCode(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
}

export function validateVanityCodeFormat(code) {
  const normalized = normalizeVanityCode(code)
  if (!normalized) return { ok: false, error: 'VANITY_CODE_REQUIRED' }
  if (normalized.length < 3 || normalized.length > 48) {
    return { ok: false, error: 'VANITY_CODE_LENGTH' }
  }
  if (!VANITY_PATTERN.test(normalized)) {
    return { ok: false, error: 'VANITY_CODE_FORMAT' }
  }
  return { ok: true, code: normalized }
}

export async function resolveReferrerByVanityCode(vanityRaw) {
  const fmt = validateVanityCodeFormat(vanityRaw)
  if (!fmt.ok) return { error: fmt.error, status: 400 }

  const { data, error } = await supabaseAdmin
    .from('referral_codes')
    .select('id, user_id, code, custom_vanity_code, is_active, campaign_slug, metadata')
    .eq('custom_vanity_code', fmt.code)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return { error: error.message || 'VANITY_LOOKUP_FAILED', status: 500 }
  if (!data?.user_id) return { error: 'VANITY_CODE_NOT_FOUND', status: 404 }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, email, first_name, last_name, referral_code, iana_timezone')
    .eq('id', data.user_id)
    .maybeSingle()

  if (!profile?.id) return { error: 'VANITY_REFERRER_NOT_FOUND', status: 404 }

  return {
    data: {
      referrerProfile: profile,
      referralCodeRow: data,
      code: String(data.code || '').trim().toUpperCase(),
      vanityCode: fmt.code,
      campaignSlug:
        String(data?.campaign_slug || data?.metadata?.campaign_slug || '').trim() || null,
    },
  }
}

export async function setCustomVanityCodeForUser(userId, vanityRaw) {
  const uid = String(userId || '').trim()
  if (!uid) return { success: false, error: 'USER_ID_REQUIRED', status: 400 }

  const fmt = validateVanityCodeFormat(vanityRaw)
  if (!fmt.ok) return { success: false, error: fmt.error, status: 400 }

  const { data: existing } = await supabaseAdmin
    .from('referral_codes')
    .select('id, code')
    .eq('user_id', uid)
    .maybeSingle()

  if (!existing?.id) return { success: false, error: 'REFERRAL_CODE_NOT_FOUND', status: 404 }

  const { data: taken } = await supabaseAdmin
    .from('referral_codes')
    .select('id, user_id')
    .eq('custom_vanity_code', fmt.code)
    .neq('user_id', uid)
    .maybeSingle()

  if (taken?.id) return { success: false, error: 'VANITY_CODE_TAKEN', status: 409 }

  const { error } = await supabaseAdmin
    .from('referral_codes')
    .update({ custom_vanity_code: fmt.code, updated_at: new Date().toISOString() })
    .eq('user_id', uid)

  if (error) {
    if (/unique|duplicate/i.test(String(error.message || ''))) {
      return { success: false, error: 'VANITY_CODE_TAKEN', status: 409 }
    }
    return { success: false, error: error.message || 'VANITY_UPDATE_FAILED', status: 500 }
  }

  return { success: true, data: { vanityCode: fmt.code, referralCode: existing.code } }
}

export async function clearCustomVanityCodeForUser(userId) {
  const uid = String(userId || '').trim()
  if (!uid) return { success: false, error: 'USER_ID_REQUIRED', status: 400 }
  const { error } = await supabaseAdmin
    .from('referral_codes')
    .update({ custom_vanity_code: null, updated_at: new Date().toISOString() })
    .eq('user_id', uid)
  if (error) return { success: false, error: error.message, status: 500 }
  return { success: true }
}

export default {
  normalizeVanityCode,
  validateVanityCodeFormat,
  resolveReferrerByVanityCode,
  setCustomVanityCodeForUser,
  clearCustomVanityCodeForUser,
}
