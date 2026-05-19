/**
 * SSOT: проверка / фиксация согласия с юр. документами (гость, оплата, партнёр).
 */
import { supabaseAdmin } from '@/lib/supabase'
import {
  CURRENT_LEGAL_TERMS_VERSION,
  CURRENT_PARTNER_TERMS_VERSION,
} from '@/lib/config/legal-terms-version'

export const LEGAL_CONSENT_ERROR_CODE = 'LEGAL_CONSENT_REQUIRED'

function parseAcceptedFlag(raw) {
  return raw === true || raw === 'true' || raw === 1 || raw === '1'
}

function isMissingColumnError(err, hint) {
  const msg = String(err?.message || '').toLowerCase()
  return err?.code === '42703' || msg.includes(hint)
}

/**
 * Записать акцепт оферты в profiles и (опционально) bookings.
 * @returns {Promise<{ ok: true, recordedAt: string, termsVersion: string } | { ok: false, error: string, status?: number }>}
 */
export async function recordGuestLegalConsent({ userId, bookingId = null }) {
  if (!userId) {
    return { ok: false, error: 'User id required', status: 400 }
  }

  const iso = new Date().toISOString()
  const termsVersion = CURRENT_LEGAL_TERMS_VERSION

  const profilePayload = {
    terms_accepted: true,
    terms_accepted_at: iso,
    legal_terms_accepted_at: iso,
    terms_version: termsVersion,
    updated_at: iso,
  }

  let { error: profileErr } = await supabaseAdmin.from('profiles').update(profilePayload).eq('id', userId)

  if (profileErr && isMissingColumnError(profileErr, 'terms_version')) {
    const { error: fallbackErr } = await supabaseAdmin
      .from('profiles')
      .update({
        legal_terms_accepted_at: iso,
        updated_at: iso,
      })
      .eq('id', userId)
    profileErr = fallbackErr
  }

  if (profileErr) {
    return { ok: false, error: profileErr.message || 'Failed to save legal consent', status: 500 }
  }

  if (bookingId) {
    const bookingPayload = {
      terms_accepted_at: iso,
      terms_version: termsVersion,
      updated_at: iso,
    }
    let { error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .update(bookingPayload)
      .eq('id', bookingId)

    if (bookingErr && isMissingColumnError(bookingErr, 'terms_accepted_at')) {
      bookingErr = null
    } else if (bookingErr) {
      return { ok: false, error: bookingErr.message || 'Failed to save booking legal consent', status: 500 }
    }
  }

  return { ok: true, recordedAt: iso, termsVersion }
}

/**
 * Фиксация версии гостевой оферты на брони после успешного перехода в PAID_ESCROW.
 * SSOT для «какая редакция действовала при оплате».
 */
export async function stampBookingTermsOnSuccessfulPayment(bookingId) {
  if (!bookingId) {
    return { ok: false, error: 'Booking id required', status: 400 }
  }

  const iso = new Date().toISOString()
  const termsVersion = CURRENT_LEGAL_TERMS_VERSION
  const payload = {
    terms_accepted_at: iso,
    terms_version: termsVersion,
    updated_at: iso,
  }

  let { error } = await supabaseAdmin.from('bookings').update(payload).eq('id', bookingId)

  if (error && isMissingColumnError(error, 'terms_version')) {
    return { ok: true, recordedAt: iso, termsVersion, skippedColumns: true }
  }

  if (error) {
    return { ok: false, error: error.message || 'Failed to stamp booking terms', status: 500 }
  }

  return { ok: true, recordedAt: iso, termsVersion }
}

/**
 * Акцепт условий для хостов (заявка партнёра).
 */
export async function recordPartnerLegalConsent(userId) {
  if (!userId) {
    return { ok: false, error: 'User id required', status: 400 }
  }

  const iso = new Date().toISOString()
  const version = CURRENT_PARTNER_TERMS_VERSION

  const payload = {
    partner_terms_accepted_at: iso,
    partner_terms_version: version,
    updated_at: iso,
  }

  let { error } = await supabaseAdmin.from('profiles').update(payload).eq('id', userId)

  if (error && isMissingColumnError(error, 'partner_terms')) {
    return { ok: true, recordedAt: iso, termsVersion: version, skippedColumns: true }
  }

  if (error) {
    return { ok: false, error: error.message || 'Failed to save partner terms consent', status: 500 }
  }

  return { ok: true, recordedAt: iso, termsVersion: version }
}

/**
 * Перед оплатой: явный акцепт в теле запроса + запись в profiles и bookings.
 *
 * @param {string|null|undefined} sessionUserId
 * @param {unknown} bodyAccepted — `acceptedLegalTerms`
 * @param {string|null|undefined} bookingId
 */
export async function ensureProfileLegalConsentForPayment(sessionUserId, bodyAccepted, bookingId = null) {
  if (!sessionUserId) {
    return { ok: false, error: 'Authentication required', code: 'UNAUTHORIZED', status: 401 }
  }

  if (!parseAcceptedFlag(bodyAccepted)) {
    return {
      ok: false,
      error: 'Accept the Public Offer to continue.',
      code: LEGAL_CONSENT_ERROR_CODE,
      status: 403,
    }
  }

  return recordGuestLegalConsent({ userId: sessionUserId, bookingId })
}
