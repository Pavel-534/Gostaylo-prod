/**
 * Stage 151.2 — shadow payment-instrument fingerprint extraction (card hash / gateway session).
 * Read-only SSOT for ReferralFraudGate PAYMENT_INSTRUMENT_COLLISION checks.
 */
import { supabaseAdmin } from '@/lib/supabase'

const DIRECT_TOKEN_KEYS = [
  'payment_instrument_hash',
  'card_hash',
  'instrument_fingerprint',
  'gateway_session_id',
  'payment_method_id',
]

/**
 * @param {unknown} payload
 * @param {string | null | undefined} [gatewayRef]
 * @returns {Set<string>}
 */
export function extractPaymentInstrumentTokensFromPayload(payload, gatewayRef = null) {
  const tokens = new Set()
  const root = payload && typeof payload === 'object' ? payload : {}

  for (const key of DIRECT_TOKEN_KEYS) {
    const v = String(root[key] || '').trim()
    if (v) tokens.add(`${key}:${v}`)
  }

  const pm = root.payment_method || root.object?.payment_method
  if (pm && typeof pm === 'object') {
    const pmId = String(pm.id || '').trim()
    if (pmId) tokens.add(`payment_method_id:${pmId}`)
    const card = pm.card
    if (card && typeof card === 'object') {
      const composite = [card.first6, card.last4, card.expiry_month, card.expiry_year]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .join(':')
      if (composite) tokens.add(`card_fp:${composite}`)
    }
  }

  const sessionId = String(root.gateway_session_id || root.checkout_session_id || '').trim()
  if (sessionId) tokens.add(`gateway_session_id:${sessionId}`)

  if (root.verification?.raw) {
    extractPaymentInstrumentTokensFromPayload(root.verification.raw, null).forEach((t) => tokens.add(t))
  }
  if (root.raw && typeof root.raw === 'object') {
    extractPaymentInstrumentTokensFromPayload(root.raw, null).forEach((t) => tokens.add(t))
  }

  const gr = String(gatewayRef || root.gateway_ref || '').trim()
  if (gr && root.gateway_session_id) {
    tokens.add(`gateway_ref:${gr}`)
  }

  return tokens
}

/**
 * @param {string} userId
 * @returns {Promise<Set<string>>}
 */
export async function collectPaymentInstrumentTokensForUser(userId) {
  const tokens = new Set()
  const uid = String(userId || '').trim()
  if (!uid || !supabaseAdmin) return tokens

  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('id, metadata')
    .eq('renter_id', uid)
    .order('created_at', { ascending: false })
    .limit(40)

  const bookingIds = (bookings || []).map((b) => String(b.id)).filter(Boolean)
  for (const b of bookings || []) {
    extractPaymentInstrumentTokensFromPayload(b.metadata).forEach((t) => tokens.add(t))
  }

  if (!bookingIds.length) return tokens

  const [{ data: payments }, { data: intents }] = await Promise.all([
    supabaseAdmin
      .from('payments')
      .select('metadata, gateway_ref')
      .in('booking_id', bookingIds)
      .limit(80),
    supabaseAdmin
      .from('payment_intents')
      .select('metadata, external_ref, id')
      .in('booking_id', bookingIds)
      .limit(80),
  ])

  for (const p of payments || []) {
    extractPaymentInstrumentTokensFromPayload(p.metadata, p.gateway_ref).forEach((t) => tokens.add(t))
  }
  for (const pi of intents || []) {
    extractPaymentInstrumentTokensFromPayload(pi.metadata, pi.external_ref).forEach((t) => tokens.add(t))
  }

  return tokens
}

/**
 * @param {string} bookingId
 * @returns {Promise<Set<string>>}
 */
export async function collectPaymentInstrumentTokensForBooking(bookingId) {
  const tokens = new Set()
  const bid = String(bookingId || '').trim()
  if (!bid || !supabaseAdmin) return tokens

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('metadata')
    .eq('id', bid)
    .maybeSingle()
  extractPaymentInstrumentTokensFromPayload(booking?.metadata).forEach((t) => tokens.add(t))

  const [{ data: payments }, { data: intents }] = await Promise.all([
    supabaseAdmin.from('payments').select('metadata, gateway_ref').eq('booking_id', bid).limit(20),
    supabaseAdmin
      .from('payment_intents')
      .select('metadata, external_ref, id')
      .eq('booking_id', bid)
      .limit(20),
  ])

  for (const p of payments || []) {
    extractPaymentInstrumentTokensFromPayload(p.metadata, p.gateway_ref).forEach((t) => tokens.add(t))
  }
  for (const pi of intents || []) {
    extractPaymentInstrumentTokensFromPayload(pi.metadata, pi.external_ref).forEach((t) => tokens.add(t))
  }

  return tokens
}

/**
 * Shadow collision: shared card hash or gateway session between referrer and referee.
 * @param {string} referrerId
 * @param {string} refereeId
 * @param {string | null | undefined} [bookingId]
 */
export async function detectPaymentInstrumentCollision(referrerId, refereeId, bookingId = null) {
  const rid = String(referrerId || '').trim()
  const fid = String(refereeId || '').trim()
  if (!rid || !fid || rid === fid) {
    return { collision: false, sharedTokens: [], referrerTokenCount: 0, refereeTokenCount: 0 }
  }

  const [referrerTokens, refereeTokens] = await Promise.all([
    collectPaymentInstrumentTokensForUser(rid),
    collectPaymentInstrumentTokensForUser(fid),
  ])

  if (bookingId) {
    const bookingTokens = await collectPaymentInstrumentTokensForBooking(String(bookingId))
    bookingTokens.forEach((t) => refereeTokens.add(t))
  }

  const sharedTokens = [...referrerTokens].filter((t) => refereeTokens.has(t))
  return {
    collision: sharedTokens.length > 0,
    sharedTokens,
    referrerTokenCount: referrerTokens.size,
    refereeTokenCount: refereeTokens.size,
  }
}

export default {
  extractPaymentInstrumentTokensFromPayload,
  collectPaymentInstrumentTokensForUser,
  collectPaymentInstrumentTokensForBooking,
  detectPaymentInstrumentCollision,
}
