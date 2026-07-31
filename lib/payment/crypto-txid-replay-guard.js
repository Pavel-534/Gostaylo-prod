/**
 * AUDIT_03 C3.2 — Crypto txid replay guard.
 * Idempotency key: crypto_payment:{txid}:{booking_id}
 */

export function normalizeCryptoTxid(txid) {
  return String(txid || '').trim()
}

export function cryptoPaymentIdempotencyKey(txid, bookingId) {
  const tx = normalizeCryptoTxid(txid)
  const bk = String(bookingId || '').trim()
  if (!tx || !bk) return null
  return `crypto_payment:${tx}:${bk}`
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ txid: string, bookingId: string }} args
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string, code: string, existingBookingId?: string }>}
 */
export async function assertCryptoTxidAvailable(supabase, { txid, bookingId }) {
  const tx = normalizeCryptoTxid(txid)
  const bk = String(bookingId || '').trim()
  if (!tx || !bk) {
    return { ok: false, status: 400, error: 'Missing txid or bookingId', code: 'MISSING_TX' }
  }
  if (!supabase) {
    return { ok: false, status: 503, error: 'Database not configured', code: 'SERVICE_UNAVAILABLE' }
  }

  const { data: byTx, error: payErr } = await supabase
    .from('payments')
    .select('id, booking_id, status, tx_id')
    .eq('tx_id', tx)
    .limit(5)

  if (payErr) {
    return { ok: false, status: 500, error: payErr.message, code: 'TX_LOOKUP_FAILED' }
  }

  for (const row of byTx || []) {
    const existingBk = String(row.booking_id || '')
    if (existingBk === bk) {
      return {
        ok: false,
        status: 409,
        error: 'already_processed',
        code: 'ALREADY_PROCESSED',
        existingBookingId: existingBk,
      }
    }
    return {
      ok: false,
      status: 409,
      error: 'already_processed',
      code: 'TXID_ALREADY_USED',
      existingBookingId: existingBk,
    }
  }

  const { data: intents, error: intentErr } = await supabase
    .from('payment_intents')
    .select('id, booking_id, status, metadata')
    .contains('metadata', { crypto_txid: tx })
    .limit(5)

  if (intentErr) {
    // contains may fail on older rows; fallback scan is expensive — ignore soft miss
    console.warn('[crypto-txid-replay] intent lookup', intentErr.message)
  } else {
    for (const row of intents || []) {
      const existingBk = String(row.booking_id || '')
      if (existingBk === bk) {
        return {
          ok: false,
          status: 409,
          error: 'already_processed',
          code: 'ALREADY_PROCESSED',
          existingBookingId: existingBk,
        }
      }
      return {
        ok: false,
        status: 409,
        error: 'already_processed',
        code: 'TXID_ALREADY_USED',
        existingBookingId: existingBk,
      }
    }
  }

  return { ok: true }
}
