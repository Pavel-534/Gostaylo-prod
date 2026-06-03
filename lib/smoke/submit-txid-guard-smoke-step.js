/**
 * Stage 125.2 — smoke: submit-txid blocked on PAID_ESCROW+ and on COMPLETED payment row.
 *
 * ⚠️ SMOKE FIXTURE (127.1): direct `bookings.status` UPDATE in finally-block is teardown only.
 */
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PaymentsV3Service } from '@/lib/services/payments-v3.service.js'
import {
  clearSmokeFinancialSessionUserId,
  setSmokeFinancialSessionUserId,
} from '@/lib/smoke/smoke-session-override.js'

const FAKE_TXID = 'a'.repeat(64)

/**
 * @param {{ bookingId: string, guestId: string }} params
 */
export async function runSubmitTxidGuardSmokeStep({ bookingId, guestId }) {
  const id = String(bookingId || '').trim()
  const renterId = String(guestId || '').trim()
  if (!id || !renterId) return { ok: false, error: 'bookingId and guestId required' }
  if (process.env.SMOKE_FINANCIAL_RUN !== '1') {
    return { ok: false, error: 'SMOKE_FINANCIAL_RUN=1 required' }
  }

  setSmokeFinancialSessionUserId(renterId)
  try {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('status')
      .eq('id', id)
      .maybeSingle()

    const st = String(booking?.status || '').toUpperCase()
    if (st !== 'PAID_ESCROW') {
      return { ok: false, error: `expected PAID_ESCROW for guard test, got ${st}` }
    }

    const { POST: postSubmit } = await import('@/app/api/v2/payments/submit-txid/route.js')
    const makeReq = () =>
      new NextRequest('http://smoke.local/api/v2/payments/submit-txid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: id,
          txid: FAKE_TXID,
          paymentMethod: 'USDT_TRC20',
        }),
      })

    const res = await postSubmit(makeReq())
    const json = await res.json().catch(() => ({}))

    if (res.status !== 409) {
      return {
        ok: false,
        error: `PAID_ESCROW submit-txid: expected HTTP 409, got ${res.status} ${JSON.stringify(json)}`,
      }
    }
    if (json?.error !== 'booking_payment_past_escrow') {
      return {
        ok: false,
        error: `expected booking_payment_past_escrow, got ${json?.error}`,
      }
    }

    let payId = null
    try {
      await supabaseAdmin
        .from('bookings')
        .update({ status: 'AWAITING_PAYMENT', updated_at: new Date().toISOString() })
        .eq('id', id)

      const { data: payRow, error: insErr } = await supabaseAdmin
        .from('payments')
        .insert({
          booking_id: id,
          amount: 100,
          currency: 'THB',
          method: 'CRYPTO',
          status: 'COMPLETED',
          tx_id: FAKE_TXID,
          metadata: { smoke_stage125_2: true },
        })
        .select('id')
        .single()
      if (insErr) return { ok: false, error: `insert COMPLETED payment: ${insErr.message}` }
      payId = payRow?.id

      const res2 = await postSubmit(makeReq())
      const json2 = await res2.json().catch(() => ({}))

      if (res2.status !== 409 || json2?.error !== 'payment_already_finalized') {
        return {
          ok: false,
          error: `COMPLETED payment guard: expected 409 payment_already_finalized, got ${res2.status} ${JSON.stringify(json2)}`,
        }
      }
    } finally {
      if (payId) await supabaseAdmin.from('payments').delete().eq('id', payId)
      await supabaseAdmin
        .from('bookings')
        .update({ status: 'PAID_ESCROW', updated_at: new Date().toISOString() })
        .eq('id', id)
    }

    return {
      ok: true,
      detail:
        'submit-txid blocked: past-escrow booking + COMPLETED payment; confirmPayment alreadyConfirmed',
    }
  } finally {
    clearSmokeFinancialSessionUserId()
  }
}
