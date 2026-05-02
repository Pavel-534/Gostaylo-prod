/**
 * SSOT: проверка / фиксация согласия с юр. документами перед платёжными действиями гостя.
 */
import { supabaseAdmin } from '@/lib/supabase'

export const LEGAL_CONSENT_ERROR_CODE = 'LEGAL_CONSENT_REQUIRED'

function parseAcceptedFlag(raw) {
  return raw === true || raw === 'true' || raw === 1 || raw === '1'
}

/**
 * Если у профиля уже есть метка — ok. Если в теле запроса явное согласие — пишем now() и ok.
 * Иначе 403 LEGAL_CONSENT_REQUIRED для гостя с активной сессией.
 *
 * @param {string|null|undefined} sessionUserId — id из JWT
 * @param {unknown} bodyAccepted — `acceptedLegalTerms` из JSON body
 */
export async function ensureProfileLegalConsentForPayment(sessionUserId, bodyAccepted) {
  if (!sessionUserId) {
    return { ok: false, error: 'Authentication required', code: 'UNAUTHORIZED', status: 401 }
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, legal_terms_accepted_at')
    .eq('id', sessionUserId)
    .maybeSingle()

  if (error || !profile) {
    return { ok: false, error: 'Profile not found', code: 'PROFILE_NOT_FOUND', status: 404 }
  }

  if (profile.legal_terms_accepted_at) {
    return { ok: true }
  }

  if (!parseAcceptedFlag(bodyAccepted)) {
    return {
      ok: false,
      error: 'Accept the Public Offer and Privacy Policy to continue.',
      code: LEGAL_CONSENT_ERROR_CODE,
      status: 403,
    }
  }

  const iso = new Date().toISOString()
  const { error: upErr } = await supabaseAdmin
    .from('profiles')
    .update({ legal_terms_accepted_at: iso })
    .eq('id', sessionUserId)

  if (upErr) {
    return { ok: false, error: upErr.message || 'Failed to save legal consent', status: 500 }
  }

  return { ok: true, recordedAt: iso }
}
