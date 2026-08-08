/**
 * Stage 23.0 / 200.72 — Emergency contact SMS channel.
 * Uses `dispatchSms` when phone + provider are available; never claims SMS sent on failure.
 * Fallback path: partner push + admin Telegram/Ops (wired by the emergency-contact route).
 */

import { dispatchSms, maskPhoneE164 } from '@/lib/auth/sms-dispatch.service.js'
import { getSiteDisplayName } from '@/lib/site-url'

/**
 * @param {{
 *   partnerPhone?: string | null,
 *   bookingId?: string | null,
 *   listingTitle?: string | null,
 * }} params
 * @returns {Promise<{
 *   smsSent: boolean,
 *   mocked?: boolean,
 *   provider?: string | null,
 *   channel: 'sms' | 'ops_fallback',
 *   reason?: string,
 *   error_code?: string,
 * }>}
 */
export async function sendEmergencySMS({ partnerPhone, bookingId = null, listingTitle = null } = {}) {
  const phone = partnerPhone != null ? String(partnerPhone).trim() : ''
  const brand = getSiteDisplayName()
  const listing = listingTitle ? String(listingTitle).slice(0, 80) : 'listing'
  const bookingHint = bookingId ? String(bookingId).slice(0, 40) : ''

  if (!phone) {
    console.warn(
      '[emergency-sms] no partner phone — SMS skipped; rely on push + Telegram/Ops escalation',
      { bookingId: bookingHint || null },
    )
    return {
      smsSent: false,
      channel: 'ops_fallback',
      reason: 'no_phone',
      provider: null,
    }
  }

  const body = bookingHint
    ? `${brand}: emergency contact from guest on "${listing}" (booking ${bookingHint}). Open partner bookings ASAP.`
    : `${brand}: emergency contact from guest on "${listing}". Open partner bookings ASAP.`

  const result = await dispatchSms({
    phoneE164: phone,
    body,
    context: 'emergency_contact',
  })

  if (result.ok) {
    console.log('[emergency-sms] dispatched', {
      phone: maskPhoneE164(phone),
      provider: result.provider,
      mocked: Boolean(result.mocked),
      bookingId: bookingHint || null,
    })
    return {
      smsSent: true,
      mocked: Boolean(result.mocked),
      provider: result.provider || null,
      channel: 'sms',
    }
  }

  console.warn(
    '[emergency-sms] SMS not delivered — push + Telegram/Ops remain primary escalation',
    {
      phone: maskPhoneE164(phone),
      error_code: result.error_code || 'AUTH_SMS_DELIVERY_FAILED',
      provider: result.provider || null,
      bookingId: bookingHint || null,
    },
  )

  return {
    smsSent: false,
    channel: 'ops_fallback',
    reason: 'sms_failed_or_unconfigured',
    error_code: result.error_code || 'AUTH_SMS_DELIVERY_FAILED',
    provider: result.provider || null,
  }
}
