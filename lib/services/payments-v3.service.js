import { supabaseAdmin } from '@/lib/supabase'
import EscrowService from '@/lib/services/escrow.service'
import { logStructured } from '@/lib/critical-telemetry.js'
import { isPaymentAcquiringWebhookIdempotentBookingStatus } from '@/lib/booking/status-sets.js'

export const PaymentMethod = {
  USDT_TRC20: 'CRYPTO',
  CARD_INTL: 'CARD',
  CARD_RU: 'MIR',
  THAI_QR: 'CRYPTO',
  CRYPTO: 'CRYPTO',
  CARD: 'CARD',
  MIR: 'MIR',
}

export const PaymentStatus = {
  PENDING: 'PENDING',
  VERIFYING: 'VERIFYING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
}

/** Stage 125.2 / 127.2 — finalized legacy `payments` rows (no PENDING regression, no repeat escrow). */
const SUBMIT_TXID_FINALIZED_PAYMENT_STATUSES = new Set([
  PaymentStatus.CONFIRMED,
  PaymentStatus.COMPLETED,
])

function normalizeMethod(method) {
  const raw = String(method || '').toUpperCase().trim()
  if (raw === 'USDT_TRC20' || raw === 'THAI_QR') return 'CRYPTO'
  if (raw === 'CARD_INTL') return 'CARD'
  if (raw === 'CARD_RU') return 'MIR'
  if (raw === 'CRYPTO' || raw === 'CARD' || raw === 'MIR') return raw
  return 'CRYPTO'
}

function mapPaymentRow(row) {
  const method = row.method
  return {
    id: row.id,
    booking_id: row.booking_id,
    bookingId: row.booking_id,
    amount: parseFloat(row.amount) || 0,
    currency: row.currency,
    method,
    payment_method: method,
    status: row.status,
    txid: row.tx_id || null,
    txId: row.tx_id || null,
    gatewayRef: row.gateway_ref || null,
    metadata: row.metadata || {},
    created_at: row.created_at,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
    booking: row.booking || null,
  }
}

export class PaymentsV3Service {
  static async countPendingPayments() {
    const { count, error } = await supabaseAdmin
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', PaymentStatus.PENDING)
    if (error) return { success: false, count: 0, error: error.message }
    return { success: true, count: count || 0 }
  }

  static async getPayments(filters = {}) {
    let query = supabaseAdmin
      .from('payments')
      .select(
        '*, booking:bookings(id, status, listing_id, partner_id, renter_id, price_thb, commission_thb, rounding_diff_pot, pricing_snapshot, guest_name, guest_email, listing:listings(title))',
      )
      .order('created_at', { ascending: false })

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.paymentMethod) query = query.eq('method', normalizeMethod(filters.paymentMethod))
    if (filters.limit) query = query.limit(Math.max(1, Number(filters.limit)))

    const { data, error } = await query
    if (error) return { success: false, payments: [], error: error.message }
    return { success: true, payments: (data || []).map(mapPaymentRow) }
  }

  static async getPendingPayments(filters = {}) {
    return this.getPayments({ ...filters, status: PaymentStatus.PENDING })
  }

  static async submitTxid(bookingId, txid, paymentMethod = 'CRYPTO') {
    const normalized = normalizeMethod(paymentMethod)
    const now = new Date().toISOString()

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, status, price_paid, price_thb, currency')
      .eq('id', bookingId)
      .maybeSingle()
    if (bookingError) return { success: false, error: bookingError.message }
    if (!booking?.id) return { success: false, error: 'Booking not found' }

    // Booking FSM past capture — no new txid / no PENDING regression (card intent path may lack payments row).
    if (isPaymentAcquiringWebhookIdempotentBookingStatus(booking.status)) {
      return {
        success: false,
        error: 'booking_payment_past_escrow',
        message: 'Оплата по брони уже зафиксирована; повторная отправка TXID недоступна',
        statusCode: 409,
      }
    }

    const { data: existing } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      const payStatus = String(existing.status || '').toUpperCase()
      if (SUBMIT_TXID_FINALIZED_PAYMENT_STATUSES.has(payStatus)) {
        return {
          success: false,
          error: 'payment_already_finalized',
          message: 'Невозможно изменить статус уже подтверждённого платежа',
          statusCode: 409,
        }
      }

      const { data, error } = await supabaseAdmin
        .from('payments')
        .update({
          status: PaymentStatus.PENDING,
          tx_id: txid,
          method: normalized,
          metadata: {
            ...(existing.metadata || {}),
            txid_submitted_at: now,
          },
        })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, payment: mapPaymentRow(data) }
    }

    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert({
        booking_id: bookingId,
        amount: booking.price_paid || booking.price_thb,
        currency: booking.currency || 'THB',
        method: normalized,
        status: PaymentStatus.PENDING,
        tx_id: txid,
        metadata: {
          txid_submitted_at: now,
        },
      })
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, payment: mapPaymentRow(data) }
  }

  /**
   * Legacy `payments` row capture. Webhook idempotency is booking-status SSOT first;
   * this short-circuit avoids repeat UPDATE + moveToEscrow when the row is already final (127.2).
   */
  static async confirmPayment(paymentId, verificationData = {}) {
    const now = new Date().toISOString()
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()
    if (fetchError || !payment) return { success: false, error: 'Payment not found' }

    const payStatus = String(payment.status || '').toUpperCase()
    if (SUBMIT_TXID_FINALIZED_PAYMENT_STATUSES.has(payStatus)) {
      return {
        success: true,
        alreadyConfirmed: true,
        payment: mapPaymentRow(payment),
      }
    }

    logStructured({
      module: 'PaymentsV3Service',
      stage: 'confirmPayment',
      paymentId: String(paymentId),
      bookingId: payment.booking_id ? String(payment.booking_id) : null,
      source: verificationData?.source || null,
    })

    const { data: updated, error } = await supabaseAdmin
      .from('payments')
      .update({
        status: PaymentStatus.CONFIRMED,
        completed_at: now,
        metadata: {
          ...(payment.metadata || {}),
          verification: verificationData,
          verified_at: now,
        },
      })
      .eq('id', paymentId)
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }

    const escrow = await EscrowService.moveToEscrow(payment.booking_id, {
      ...verificationData,
      payment_id: paymentId,
    })
    if (!escrow?.success) {
      return { success: false, error: escrow?.error || 'Escrow transition failed', payment: mapPaymentRow(updated) }
    }

    return { success: true, payment: mapPaymentRow(updated), escrow: escrow.escrow }
  }

  static async rejectPayment(paymentId, reason = '') {
    const now = new Date().toISOString()
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()
    if (fetchError || !payment) return { success: false, error: 'Payment not found' }

    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({
        status: PaymentStatus.FAILED,
        metadata: {
          ...(payment.metadata || {}),
          rejected_at: now,
          rejection_reason: String(reason || '').slice(0, 500),
        },
      })
      .eq('id', paymentId)
      .select('*')
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, payment: mapPaymentRow(data) }
  }

  static async requestPayout(partnerId, amount, method, details = {}) {
    return EscrowService.requestPayout(partnerId, Number(amount), {
      ...details,
      method: normalizeMethod(method),
    })
  }
}

export default PaymentsV3Service
